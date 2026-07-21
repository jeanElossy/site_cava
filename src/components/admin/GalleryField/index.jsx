import { useRef, useState } from "react";

import {
  AlertCircle,
  GripVertical,
  Images,
  Loader2,
  Plus,
  X,
} from "lucide-react";

import { uploadFile, thumbnail } from "../../../services/uploads";

import "./GalleryField.scss";

// Galerie d'images : plusieurs fichiers, réordonnables.
//
// La valeur reste un TABLEAU DE CHAÎNES (des URL), exactement ce
// qu'attend le modèle Ministry. Ni l'API ni le site public ne changent.
//
// L'ordre compte : c'est celui dans lequel les images s'affichent sur
// la page du ministère. D'où le glisser-déposer pour réordonner, plutôt
// qu'une simple liste où seule la suppression serait possible.
const GalleryField = ({
  value = [],
  onChange,
  folder = "ministries",
  max = 30,
  disabled = false,
}) => {
  const inputRef = useRef(null);
  const dragIndex = useRef(null);

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [over, setOver] = useState(null);

  const images = Array.isArray(value) ? value : [];

  const sendMany = async (files) => {
    const list = Array.from(files ?? []);

    if (list.length === 0 || busy) return;

    const room = max - images.length;

    if (room <= 0) {
      setError(`Maximum atteint : ${max} images.`);

      return;
    }

    const batch = list.slice(0, room);

    setBusy(true);
    setError("");
    setDone(0);
    setTotal(batch.length);

    const added = [];
    const failures = [];

    // Envois séquentiels et non parallèles : lancer dix requêtes
    // simultanées sature une connexion modeste et fait échouer
    // l'ensemble. Une par une, la progression est aussi lisible.
    for (const file of batch) {
      try {
        const result = await uploadFile(file, {
          folder,
          accept: "image",
        });

        added.push(result.url);
      } catch (caught) {
        failures.push(`${file.name} : ${caught.message}`);
      }

      setDone((previous) => previous + 1);
    }

    // Les images réussies sont conservées même si d'autres ont
    // échoué : perdre huit envois parce que le neuvième était trop
    // lourd serait inacceptable.
    if (added.length > 0) onChange([...images, ...added]);

    if (failures.length > 0) {
      setError(
        `${failures.length} fichier(s) non envoyé(s). ${failures[0]}`
      );
    }

    if (list.length > room) {
      setError(
        `Seules ${room} image(s) ont été ajoutées : le maximum est de ${max}.`
      );
    }

    setBusy(false);
    setTotal(0);
  };

  const removeAt = (index) =>
    onChange(images.filter((_unused, i) => i !== index));

  const moveTo = (from, to) => {
    if (from === to || from == null || to == null) return;

    const next = [...images];

    const [moved] = next.splice(from, 1);

    next.splice(to, 0, moved);

    onChange(next);
  };

  return (
    <div className="admin-gallery">
      <div className="admin-gallery__head">
        <span className="admin-gallery__count">
          {images.length} / {max} images
        </span>

        <button
          type="button"
          className="admin-gallery__add"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || busy || images.length >= max}
        >
          {busy ? (
            <Loader2
              className="admin-gallery__spin"
              aria-hidden="true"
            />
          ) : (
            <Plus aria-hidden="true" />
          )}

          {busy
            ? `Envoi ${done} / ${total}…`
            : "Ajouter des images"}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="admin-gallery__input"
          onChange={(event) => {
            sendMany(event.target.files);

            event.target.value = "";
          }}
          disabled={disabled || busy}
        />
      </div>

      {images.length === 0 && !busy && (
        <div className="admin-gallery__empty">
          <Images aria-hidden="true" />

          <p>
            Aucune image. Ces photos illustrent la page publique du
            ministère.
          </p>
        </div>
      )}

      {images.length > 0 && (
        <ul className="admin-gallery__grid">
          {images.map((url, index) => (
            <li
              key={`${url}-${index}`}
              className={`admin-gallery__item${
                over === index ? " admin-gallery__item--over" : ""
              }`}
              draggable={!disabled && !busy}
              onDragStart={() => {
                dragIndex.current = index;
              }}
              onDragOver={(event) => {
                event.preventDefault();

                setOver(index);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(event) => {
                event.preventDefault();

                moveTo(dragIndex.current, index);

                dragIndex.current = null;

                setOver(null);
              }}
            >
              <img
                src={thumbnail(url, 240)}
                alt=""
                loading="lazy"
              />

              <span
                className="admin-gallery__handle"
                aria-hidden="true"
              >
                <GripVertical />
              </span>

              <button
                type="button"
                className="admin-gallery__remove"
                onClick={() => removeAt(index)}
                disabled={disabled || busy}
                aria-label={`Retirer l'image ${index + 1}`}
              >
                <X aria-hidden="true" />
              </button>

              {/* Réordonnancement au clavier : le glisser-déposer
                  seul exclurait qui n'utilise pas la souris. */}
              <span className="admin-gallery__move">
                <button
                  type="button"
                  onClick={() => moveTo(index, index - 1)}
                  disabled={disabled || busy || index === 0}
                  aria-label={`Déplacer l'image ${index + 1} vers la gauche`}
                >
                  ‹
                </button>

                <button
                  type="button"
                  onClick={() => moveTo(index, index + 1)}
                  disabled={
                    disabled || busy || index === images.length - 1
                  }
                  aria-label={`Déplacer l'image ${index + 1} vers la droite`}
                >
                  ›
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p
          className="admin-gallery__error"
          role="alert"
        >
          <AlertCircle aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
};

export default GalleryField;
