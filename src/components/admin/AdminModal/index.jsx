import { useEffect, useId, useRef } from "react";

import { X } from "lucide-react";

import "./AdminModal.scss";

/**
 * Fenêtre modale accessible : rôle `dialog`, fermeture au clavier
 * (Échap), focus déplacé dans la fenêtre à l'ouverture puis rendu à
 * l'élément qui l'a ouverte, et piège de tabulation simple.
 */
const AdminModal = ({ title, description, onClose, children }) => {
  const dialogRef = useRef(null);
  const openerRef = useRef(null);

  const titleId = useId();
  const descriptionId = useId();

  // Référence toujours à jour vers `onClose`, SANS en faire une
  // dépendance de l'effet ci-dessous.
  //
  // C'est le cœur du correctif. Les pages passent une fonction fléchée
  // (`onClose={() => setPendingDelete(null)}`), recréée à chaque rendu.
  // En dépendant de `onClose`, l'effet se relançait à chaque frappe :
  // il replaçait le focus sur le premier élément de la fenêtre, et la
  // saisie devenait impossible sans recliquer dans le champ.
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Dépendances vides : la mise en place du focus et des écouteurs ne
  // doit avoir lieu qu'à l'ouverture, jamais à chaque rendu.
  useEffect(() => {
    openerRef.current = document.activeElement;

    const dialog = dialogRef.current;

    // On vise le premier champ de SAISIE, pas le premier élément
    // focusable — qui est le bouton de fermeture, placé en tête dans
    // l'en-tête. Ouvrir un formulaire avec le curseur sur la croix
    // oblige à un clic supplémentaire avant d'écrire.
    const firstInput = dialog?.querySelector(
      "input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])"
    );

    const fallback = dialog?.querySelector(
      'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    );

    (firstInput ?? fallback)?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();

        return;
      }

      if (event.key !== "Tab") return;

      const items = dialog?.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      if (!items?.length) return;

      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);

      document.body.style.overflow = previousOverflow;

      if (openerRef.current instanceof HTMLElement) {
        openerRef.current.focus();
      }
    };
  }, []);

  return (
    <div className="admin-modal">
      <div
        className="admin-modal__backdrop"
        onClick={onClose}
        aria-hidden="true"
      ></div>

      <div
        className="admin-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        ref={dialogRef}
      >
        <header className="admin-modal__header">
          <div>
            <h2 id={titleId}>{title}</h2>

            {description && (
              <p id={descriptionId}>{description}</p>
            )}
          </div>

          <button
            type="button"
            className="admin-modal__close"
            onClick={onClose}
            aria-label="Fermer la fenêtre"
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="admin-modal__body">{children}</div>
      </div>
    </div>
  );
};

export default AdminModal;
