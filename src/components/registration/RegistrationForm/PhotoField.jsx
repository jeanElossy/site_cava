import { useRef, useState } from "react";

import { Camera, Loader2, Trash2 } from "lucide-react";

import { uploadMemberPhoto, thumbnail } from "../../../services/uploads";

// Champ photo du formulaire PUBLIC d'inscription — volontairement
// distinct de `components/admin/FileField` : pas de bascule "saisir
// une adresse à la main" (n'a aucun sens pour un visiteur, qui n'a pas
// d'URL Cloudinary à donner), et un aperçu rond plutôt qu'un cadre
// large, pour annoncer visuellement "photo de profil" avant même que
// le champ soit rempli.
const PhotoField = ({ value, onChange }) => {
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  const send = async (file) => {
    if (!file || busy) return;

    setBusy(true);
    setError("");
    setProgress(0);

    const controller = new AbortController();

    abortRef.current = controller;

    try {
      const result = await uploadMemberPhoto(file, {
        signal: controller.signal,
        onProgress: setProgress,
      });

      onChange(result.url);
    } catch (caught) {
      setError(caught?.message ?? "L'envoi de la photo a échoué.");
    } finally {
      setBusy(false);
      setProgress(0);
      abortRef.current = null;
    }
  };

  const pick = () => inputRef.current?.click();

  return (
    <div className="form-group photo-field">
      <label htmlFor="reg-photo">Photo</label>

      <div
        className={`photo-field__dropzone${
          dragging ? " photo-field__dropzone--over" : ""
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          send(event.dataTransfer.files?.[0]);
        }}
      >
        <button
          type="button"
          className="photo-field__avatar"
          onClick={pick}
          disabled={busy}
          aria-label={
            value ? "Changer la photo" : "Ajouter une photo"
          }
        >
          {value && !busy ? (
            <img src={thumbnail(value, 200)} alt="" />
          ) : busy ? (
            <Loader2 className="photo-field__spin" aria-hidden="true" />
          ) : (
            <Camera aria-hidden="true" />
          )}
        </button>

        <div className="photo-field__body">
          {busy ? (
            <p>Envoi en cours… {progress} %</p>
          ) : (
            <>
              <button type="button" className="photo-field__pick" onClick={pick}>
                {value ? "Changer la photo" : "Choisir une photo"}
              </button>
              <span className="photo-field__hint">
                ou glissez-la ici — JPEG, PNG ou WebP, 10 Mo maximum
              </span>
            </>
          )}

          {value && !busy && (
            <button
              type="button"
              className="photo-field__remove"
              onClick={() => {
                onChange("");
                setError("");
              }}
            >
              <Trash2 aria-hidden="true" />
              Retirer la photo
            </button>
          )}
        </div>

        <input
          ref={inputRef}
          id="reg-photo"
          type="file"
          accept="image/*"
          className="photo-field__input"
          onChange={(event) => {
            send(event.target.files?.[0]);
            event.target.value = "";
          }}
          disabled={busy}
        />
      </div>

      {error && (
        <p className="photo-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default PhotoField;
