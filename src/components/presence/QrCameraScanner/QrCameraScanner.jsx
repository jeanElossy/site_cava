import { useCallback, useEffect, useRef, useState } from "react";

import jsQR from "jsqr";

import { Camera, RefreshCw } from "lucide-react";

import "./QrCameraScanner.scss";

// Fréquence de décodage : 5 images/s suffit largement à un scan perçu
// comme instantané, pour un coût CPU bien inférieur à une décodification
// à chaque frame vidéo (jusqu'à 60/s).
const SCAN_INTERVAL_MS = 200;

// Lecteur de QR code par caméra, réutilisé à deux endroits du badgeage
// des présences : la connexion agent (QR de sécurité, une seule lecture)
// et le scanner continu de cartes membres (voir docs/superpowers/specs/
// 2026-08-04-badgeage-presences-design.md). Aucune dépendance serveur :
// tout le décodage a lieu dans le navigateur (`jsqr`).
// Résolution de dessin de l'aperçu visible : carrée, indépendante de
// la taille d'affichage réelle (mise à l'échelle par le CSS comme une
// image) — assez nette pour un aperçu, sans coût de calcul inutile.
const PREVIEW_SIZE = 480;

// Message d'échec adapté à la CAUSE. « Vérifiez l'autorisation » était
// affiché quoi qu'il arrive, y compris quand l'autorisation était
// accordée et que l'échec venait d'ailleurs — l'agent cherchait alors
// dans les réglages du téléphone un problème qui n'y était pas.
const failureMessage = (error) => {
  switch (error?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "L'accès à la caméra a été refusé. Autorisez-le dans les réglages du navigateur, puis réessayez.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Aucune caméra utilisable n'a été trouvée sur cet appareil.";
    case "NotReadableError":
      return "La caméra est déjà utilisée par une autre application. Fermez-la, puis réessayez.";
    default:
      return "La caméra n'a pas pu démarrer. Touchez « Activer la caméra » pour réessayer.";
  }
};

// Un refus d'autorisation ne se rejoue pas avec d'autres contraintes :
// insister ne ferait que redemander, et parfois réafficher une invite
// que l'utilisateur vient de refuser.
const isPermissionError = (error) =>
  error?.name === "NotAllowedError" || error?.name === "SecurityError";

const QrCameraScanner = ({ active, onDecode, onError, hint }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const rafRef = useRef(null);

  // Chaque démarrage porte un numéro. Une reprise manuelle, ou un
  // changement de `active` pendant l'attente de l'autorisation, périme
  // le démarrage en cours : sans ce jeton, deux flux pouvaient rester
  // ouverts en même temps, la caméra du second n'étant jamais affichée.
  const runIdRef = useRef(0);

  const [status, setStatus] = useState("idle");
  const [failure, setFailure] = useState("");

  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;

    stopCamera();
    setStatus("starting");
    setFailure("");

    const fail = (error) => {
      if (runId !== runIdRef.current) return;

      const message = failureMessage(error);

      setStatus("failed");
      setFailure(message);
      onError?.(message);
    };

    // `getUserMedia` n'existe tout simplement PAS hors contexte
    // sécurisé. Sur un téléphone ouvert en http:// ou par adresse IP,
    // l'appel échouait donc sur un « undefined is not a function »
    // avalé par le catch, et l'agent voyait un message d'autorisation
    // alors qu'aucune invite n'avait jamais pu s'afficher.
    if (!navigator.mediaDevices?.getUserMedia) {
      const message = window.isSecureContext
        ? "Ce navigateur ne permet pas l'accès à la caméra."
        : "La caméra exige une connexion sécurisée (https). Ouvrez le site en https, pas par son adresse IP.";

      setStatus("failed");
      setFailure(message);
      onError?.(message);

      return;
    }

    // Contraintes de CADRAGE, en `ideal` : voir plus bas pourquoi un
    // flux non carré s'affichait comme une tranche étirée.
    let stream;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          aspectRatio: { ideal: 1 },
          width: { ideal: 720 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    } catch (error) {
      if (isPermissionError(error)) {
        fail(error);

        return;
      }

      // Repli sans la moindre contrainte. Des Android refusent le jeu
      // complet alors qu'ils ont bien une caméra utilisable : mieux
      // vaut un cadrage imparfait que pas de scanner du tout.
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      } catch (fallbackError) {
        fail(fallbackError);

        return;
      }
    }

    if (runId !== runIdRef.current) {
      stream.getTracks().forEach((track) => track.stop());

      return;
    }

    streamRef.current = stream;

    const video = videoRef.current;

    if (!video) {
      stopCamera();
      fail(new Error("video element absent"));

      return;
    }

    // Posés SUR L'ÉLÉMENT et pas seulement en JSX : React ne rend pas
    // l'attribut `muted` dans le DOM, et Chrome Android refuse de lire
    // automatiquement une vidéo qu'il ne voit pas muette. C'est l'une
    // des raisons pour lesquelles le scanner démarrait sur iPhone et
    // pas sur Android, autorisations pourtant accordées.
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("autoplay", "");

    video.srcObject = stream;

    try {
      await video.play();
    } catch {
      // NON FATAL, et c'est tout le correctif : `play()` rejette
      // couramment sur Android (AbortError quand une lecture précédente
      // est interrompue) alors que le flux est bien vivant. Cette
      // exception faisait basculer TOUT le démarrage dans le catch
      // général : ni aperçu, ni décodage, et un message d'autorisation
      // trompeur — alors qu'il n'y avait qu'à continuer.
    }

    if (runId !== runIdRef.current) return;

    const drawPreviewFrame = () => {
      const source = videoRef.current;
      const preview = previewCanvasRef.current;

      if (source && preview && source.readyState >= source.HAVE_CURRENT_DATA) {
        const { videoWidth, videoHeight } = source;

        if (videoWidth && videoHeight) {
          const size = Math.min(videoWidth, videoHeight);
          const sx = (videoWidth - size) / 2;
          const sy = (videoHeight - size) / 2;

          preview
            .getContext("2d")
            .drawImage(
              source,
              sx,
              sy,
              size,
              size,
              0,
              0,
              preview.width,
              preview.height
            );
        }
      }

      rafRef.current = window.requestAnimationFrame(drawPreviewFrame);
    };

    rafRef.current = window.requestAnimationFrame(drawPreviewFrame);

    intervalRef.current = window.setInterval(() => {
      const source = videoRef.current;
      const canvas = canvasRef.current;

      // `HAVE_CURRENT_DATA` et non plus `HAVE_ENOUGH_DATA` : sur un flux
      // caméra en direct, beaucoup d'Android plafonnent à
      // HAVE_CURRENT_DATA et n'atteignent JAMAIS HAVE_ENOUGH_DATA, qui
      // décrit un tampon suffisant pour lire sans interruption — notion
      // sans objet pour du direct. L'égalité stricte empêchait donc tout
      // décodage sur ces appareils, aperçu affiché ou non.
      if (
        !source ||
        !canvas ||
        source.readyState < source.HAVE_CURRENT_DATA
      ) {
        return;
      }

      const width = source.videoWidth;
      const height = source.videoHeight;

      if (!width || !height) return;

      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(source, 0, 0, width, height);

      const imageData = context.getImageData(0, 0, width, height);
      const result = jsQR(imageData.data, width, height, {
        inversionAttempts: "dontInvert",
      });

      if (result?.data) {
        onDecode(result.data);
      }
    }, SCAN_INTERVAL_MS);

    setStatus("ready");
    // `onDecode`/`onError` changent à chaque rendu du parent : les
    // inclure relancerait la caméra en boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopCamera]);

  useEffect(() => {
    if (!active) {
      // Pas de `setStatus` ici : l'état n'est lu que sous `active`
      // (ligne de scan et bloc de reprise), le remettre à zéro
      // déclencherait un rendu en cascade pour rien.
      runIdRef.current += 1;
      stopCamera();

      return undefined;
    }

    // Planifié plutôt qu'appelé directement, pour deux raisons : le
    // démarrage met à jour l'état, ce qui n'a pas sa place dans le corps
    // d'un effet (rendu en cascade) ; et cela laisse au navigateur le
    // temps d'attacher la balise <video> avant qu'on lui pose un flux.
    const timer = window.setTimeout(startCamera, 0);

    return () => {
      window.clearTimeout(timer);
      runIdRef.current += 1;
      stopCamera();
    };
  }, [active, startCamera, stopCamera]);

  return (
    <div className="qr-camera-scanner">
      <div className="qr-camera-scanner__frame">
        {active ? (
          <>
            <video
              ref={videoRef}
              className="qr-camera-scanner__source-video"
              playsInline
              muted
              autoPlay
              aria-hidden="true"
            />
            <canvas
              ref={previewCanvasRef}
              className="qr-camera-scanner__video"
              width={PREVIEW_SIZE}
              height={PREVIEW_SIZE}
              aria-label="Aperçu de la caméra pour la lecture du QR code"
            />
          </>
        ) : (
          <Camera
            className="qr-camera-scanner__placeholder"
            aria-hidden="true"
          />
        )}

        <span
          className="qr-camera-scanner__corner qr-camera-scanner__corner--tl"
          aria-hidden="true"
        />
        <span
          className="qr-camera-scanner__corner qr-camera-scanner__corner--tr"
          aria-hidden="true"
        />
        <span
          className="qr-camera-scanner__corner qr-camera-scanner__corner--bl"
          aria-hidden="true"
        />
        <span
          className="qr-camera-scanner__corner qr-camera-scanner__corner--br"
          aria-hidden="true"
        />

        {active && status === "ready" && (
          <span
            className="qr-camera-scanner__line"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Reprise MANUELLE. Un démarrage automatique dépend de règles de
          lecture automatique et d'autorisation que le navigateur peut
          refuser sans rien dire ; un appui de l'agent, lui, est un geste
          utilisateur explicite, que tous les navigateurs acceptent. */}
      {active && status === "failed" && (
        <div className="qr-camera-scanner__recover">
          <p role="alert">{failure}</p>

          <button type="button" onClick={startCamera}>
            <RefreshCw size={16} aria-hidden="true" />
            Activer la caméra
          </button>
        </div>
      )}

      {hint && <p className="qr-camera-scanner__hint">{hint}</p>}

      <canvas
        ref={canvasRef}
        className="qr-camera-scanner__canvas"
        aria-hidden="true"
      />
    </div>
  );
};

export default QrCameraScanner;
