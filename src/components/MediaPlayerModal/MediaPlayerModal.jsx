import {
  useEffect,
  useRef,
} from "react";

import { X, ExternalLink } from "lucide-react";

import { externalUrl } from "../Media/data/medias";

import "./MediaPlayerModal.scss";

// Fenêtre de lecture : le visiteur reste sur le site.
//
// Deux lecteurs selon la source :
//   - "youtube" → iframe youtube-nocookie (pas de cookie tant que la
//     vidéo n'est pas lancée). Autorisé par `frame-src` dans vercel.json.
//   - "file"    → lecteur HTML natif, fichier servi depuis public/.
const MediaPlayerModal = ({ item, onClose }) => {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  // Référence toujours à jour vers `onClose`, sans en faire une
  // dépendance de l'effet : la fonction passée par la page est
  // recréée à chaque rendu, et l'effet se relancerait alors sans
  // raison — en replaçant le focus au passage.
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Fermeture au clavier + piège de focus : sans cela, la tabulation
  // continue derrière la fenêtre, qui devient inutilisable au clavier.
  //
  // Dépend du seul `item` : la fenêtre s'ouvre et se ferme avec lui.
  useEffect(() => {
    if (!item) return undefined;

    const previouslyFocused = document.activeElement;

    closeRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onCloseRef.current();

        return;
      }

      if (event.key !== "Tab") return;

      const focusables =
        dialogRef.current?.querySelectorAll(
          'button, a[href], iframe, video, [tabindex]:not([tabindex="-1"])'
        );

      if (!focusables?.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    // Empêche l'arrière-plan de défiler pendant la lecture.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);

      document.body.style.overflow = previousOverflow;

      previouslyFocused?.focus?.();
    };
  }, [item]);

  if (!item) return null;

  const { video } = item;

  return (
    <div
      className="media-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`Lecture : ${item.title}`}
    >
      <div
        className="media-modal__backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="media-modal__dialog"
        ref={dialogRef}
      >
        <div className="media-modal__bar">
          <div className="media-modal__titles">
            <h2>{item.title}</h2>

            <p>{item.author}</p>
          </div>

          <button
            type="button"
            className="media-modal__close"
            onClick={onClose}
            ref={closeRef}
            aria-label="Fermer la lecture"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        <div className="media-modal__player">
          {video?.kind === "youtube" && (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`}
              title={item.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}

          {video?.kind === "file" && (
            <video
              src={video.src}
              poster={item.image}
              controls
              autoPlay
              preload="metadata"
            >
              Votre navigateur ne peut pas lire cette vidéo.
            </video>
          )}
        </div>

        <div className="media-modal__footer">
          <a
            href={externalUrl(item)}
            target="_blank"
            rel="noreferrer"
          >
            Ouvrir sur notre chaîne
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default MediaPlayerModal;
