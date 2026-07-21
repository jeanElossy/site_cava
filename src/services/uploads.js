// Envoi de fichiers depuis l'administration.
//
// Le fichier ne passe PAS par notre API : celle-ci délivre seulement
// une signature, et le navigateur envoie directement à Cloudinary.
// Faire transiter une vidéo par un service Render gratuit le ferait
// tomber (mémoire et durée de requête limitées).

import { request } from "./http";

// Taille maximale acceptée avant même de tenter l'envoi. Refuser tôt
// évite de consommer la connexion de l'utilisateur pendant plusieurs
// minutes pour finir sur un rejet du serveur distant.
const MAX_IMAGE_MB = 10;
const MAX_VIDEO_MB = 100;

const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

const VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

const AUDIO_TYPES = ["audio/mpeg", "audio/mp4", "audio/wav"];

export const uploadStatus = () =>
  request("/api/admin/uploads/status", { auth: true });

const readableSize = (bytes) => {
  const mb = bytes / (1024 * 1024);

  return mb >= 1
    ? `${mb.toFixed(1)} Mo`
    : `${Math.round(bytes / 1024)} Ko`;
};

const validate = (file, accept) => {
  const isImage = IMAGE_TYPES.includes(file.type);
  const isVideo = VIDEO_TYPES.includes(file.type);
  const isAudio = AUDIO_TYPES.includes(file.type);

  if (accept === "image" && !isImage) {
    throw new Error(
      "Format non accepté. Choisissez une image JPEG, PNG, WebP ou GIF."
    );
  }

  if (accept === "media" && !isImage && !isVideo && !isAudio) {
    throw new Error(
      "Format non accepté. Choisissez une image, une vidéo MP4/WebM ou un fichier audio."
    );
  }

  const limitMb = isVideo || isAudio ? MAX_VIDEO_MB : MAX_IMAGE_MB;

  if (file.size > limitMb * 1024 * 1024) {
    throw new Error(
      `Fichier trop volumineux (${readableSize(
        file.size
      )}). Maximum : ${limitMb} Mo.`
    );
  }
};

/**
 * Envoie un fichier et renvoie son URL publique.
 *
 * @param {File} file
 * @param {object} options
 * @param {string} options.folder   dossier logique (medias, events…)
 * @param {string} options.accept   "image" ou "media"
 * @param {Function} options.onProgress  reçoit un pourcentage 0-100
 * @param {AbortSignal} options.signal
 */
export const uploadFile = async (
  file,
  { folder = "divers", accept = "image", onProgress, signal } = {}
) => {
  validate(file, accept);

  const auth = await request("/api/admin/uploads/signature", {
    method: "POST",
    body: { folder },
    auth: true,
  });

  const form = new FormData();

  form.append("file", file);
  form.append("api_key", auth.apiKey);
  form.append("timestamp", auth.timestamp);
  form.append("signature", auth.signature);
  form.append("folder", auth.folder);

  // `auto` laisse Cloudinary reconnaître image, vidéo ou audio. Ce
  // paramètre n'entre pas dans la signature : il fait partie de
  // l'URL, pas des champs signés.
  const endpoint = `https://api.cloudinary.com/v1_1/${auth.cloudName}/auto/upload`;

  // XMLHttpRequest et non fetch : c'est la seule API qui expose la
  // progression de l'envoi. Sans elle, l'utilisateur n'a aucun retour
  // pendant qu'une vidéo de 80 Mo monte, et croit l'interface figée.
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("POST", endpoint);

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;

      onProgress?.(Math.round((event.loaded / event.total) * 100));
    });

    xhr.addEventListener("load", () => {
      let payload;

      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        reject(new Error("Réponse illisible du service de stockage."));

        return;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({
          url: payload.secure_url,
          publicId: payload.public_id,
          resourceType: payload.resource_type,
          width: payload.width,
          height: payload.height,
          bytes: payload.bytes,
          format: payload.format,
        });

        return;
      }

      reject(
        new Error(
          payload?.error?.message ??
            `L'envoi a échoué (code ${xhr.status}).`
        )
      );
    });

    xhr.addEventListener("error", () =>
      reject(
        new Error(
          "L'envoi a échoué. Vérifiez votre connexion et réessayez."
        )
      )
    );

    xhr.addEventListener("abort", () =>
      reject(new Error("Envoi annulé."))
    );

    signal?.addEventListener("abort", () => xhr.abort());

    xhr.send(form);
  });
};

// Miniature Cloudinary générée à la volée par transformation d'URL.
//
// Évite de charger une photo de 4 Mo pour l'afficher dans une vignette
// de 120 pixels — c'est exactement le défaut qui plombait les
// performances des galeries du site.
export const thumbnail = (url, width = 320) => {
  if (typeof url !== "string") return url;

  if (!url.includes("/upload/")) return url;

  return url.replace(
    "/upload/",
    `/upload/c_fill,w_${width},q_auto,f_auto/`
  );
};
