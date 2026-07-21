import { useRef, useState } from "react";

import {
  AlertCircle,
  Image as ImageIcon,
  Link2,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";

import { uploadFile, thumbnail } from "../../../services/uploads";

import "./FileField.scss";

// Champ d'envoi de fichier avec glisser-déposer et aperçu.
//
// La valeur reste une CHAÎNE (l'URL du fichier), exactement comme
// avant : ni le modèle, ni l'API, ni les composants du site public
// n'ont à changer. Ce composant remplace seulement la saisie manuelle
// d'un chemin par un envoi réel.
//
// La saisie manuelle reste accessible : les médias déjà en place
// pointent vers `/images/...` dans le dépôt, et il faut pouvoir les
// modifier sans tout re-téléverser.
const FileField = ({
  value = "",
  onChange,
  folder = "divers",
  accept = "image",
  disabled = false,
  id,
}) => {
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [manual, setManual] = useState(false);

  const send = async (file) => {
    if (!file || busy) return;

    setBusy(true);
    setError("");
    setProgress(0);

    const controller = new AbortController();

    abortRef.current = controller;

    try {
      const result = await uploadFile(file, {
        folder,
        accept,
        signal: controller.signal,
        onProgress: setProgress,
      });

      onChange(result.url);
    } catch (caught) {
      setError(caught?.message ?? "L'envoi a échoué.");
    } finally {
      setBusy(false);
      setProgress(0);

      abortRef.current = null;
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();

    setDragging(false);

    if (disabled) return;

    send(event.dataTransfer.files?.[0]);
  };

  const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(value);

  return (
    <div className="admin-file">
      {value && !busy && (
        <div className="admin-file__preview">
          {isVideo ? (
            <video
              src={value}
              controls
              preload="metadata"
            />
          ) : (
            <img
              src={thumbnail(value, 320)}
              alt=""
              // Une URL erronée ne doit pas laisser une icône cassée :
              // on bascule sur un aperçu neutre.
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          )}

          <div className="admin-file__preview-info">
            <span
              className="admin-file__preview-url"
              title={value}
            >
              {value}
            </span>

            <button
              type="button"
              onClick={() => {
                onChange("");
                setError("");
              }}
              disabled={disabled}
            >
              <Trash2 aria-hidden="true" />
              Retirer
            </button>
          </div>
        </div>
      )}

      {!value && !manual && (
        <div
          className={`admin-file__drop${
            dragging ? " admin-file__drop--over" : ""
          }${busy ? " admin-file__drop--busy" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();

            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          {busy ? (
            <>
              <Loader2
                className="admin-file__spin"
                aria-hidden="true"
              />

              <p>Envoi en cours… {progress} %</p>

              <div
                className="admin-file__bar"
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span style={{ width: `${progress}%` }} />
              </div>

              <button
                type="button"
                className="admin-file__cancel"
                onClick={() => abortRef.current?.abort()}
              >
                Annuler
              </button>
            </>
          ) : (
            <>
              <ImageIcon aria-hidden="true" />

              <p>
                <button
                  type="button"
                  className="admin-file__pick"
                  onClick={() => inputRef.current?.click()}
                  disabled={disabled}
                >
                  Choisir un fichier
                </button>{" "}
                ou glissez-le ici
              </p>

              <span className="admin-file__hint">
                {accept === "image"
                  ? "JPEG, PNG ou WebP — 10 Mo maximum"
                  : "Image, vidéo MP4/WebM ou audio — 100 Mo maximum"}
              </span>
            </>
          )}

          <input
            ref={inputRef}
            id={id}
            type="file"
            accept={
              accept === "image" ? "image/*" : "image/*,video/*,audio/*"
            }
            className="admin-file__input"
            onChange={(event) => {
              send(event.target.files?.[0]);

              // Réinitialisé pour que choisir deux fois le même
              // fichier déclenche bien un second envoi.
              event.target.value = "";
            }}
            disabled={disabled || busy}
          />
        </div>
      )}

      {manual && (
        <input
          type="text"
          className="admin-file__manual"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="/images/media/exemple.jpg ou https://…"
          disabled={disabled}
        />
      )}

      {error && (
        <p
          className="admin-file__error"
          role="alert"
        >
          <AlertCircle aria-hidden="true" />
          {error}
        </p>
      )}

      {!busy && (
        <button
          type="button"
          className="admin-file__toggle"
          onClick={() => {
            setManual((previous) => !previous);
            setError("");
          }}
          disabled={disabled}
        >
          {manual ? (
            <>
              <Upload aria-hidden="true" />
              Envoyer un fichier
            </>
          ) : (
            <>
              <Link2 aria-hidden="true" />
              Saisir une adresse à la main
            </>
          )}
        </button>
      )}
    </div>
  );
};

export default FileField;
