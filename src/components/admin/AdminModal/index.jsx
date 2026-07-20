import { useEffect, useId, useRef } from "react";

import { FaTimes } from "react-icons/fa";

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

  useEffect(() => {
    openerRef.current = document.activeElement;

    const dialog = dialogRef.current;

    const focusable = dialog?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    focusable?.[0]?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();

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
  }, [onClose]);

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
            <FaTimes aria-hidden="true" />
          </button>
        </header>

        <div className="admin-modal__body">{children}</div>
      </div>
    </div>
  );
};

export default AdminModal;
