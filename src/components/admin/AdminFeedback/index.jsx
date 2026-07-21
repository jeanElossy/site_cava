import { AlertTriangle, Inbox, Loader2 } from "lucide-react";

import "./AdminFeedback.scss";

/**
 * Les trois états d'une lecture asynchrone, factorisés pour que chaque
 * écran d'administration les traite de la même façon.
 */

export const AdminLoading = ({ label = "Chargement…" }) => (
  <div
    className="admin-feedback"
    role="status"
    aria-live="polite"
  >
    <Loader2
      className="admin-feedback__spinner"
      aria-hidden="true"
    />

    <p>{label}</p>
  </div>
);

export const AdminError = ({ message, onRetry }) => (
  <div
    className="admin-feedback admin-feedback--error"
    role="alert"
  >
    <AlertTriangle aria-hidden="true" />

    <p>{message}</p>

    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
      >
        Réessayer
      </button>
    )}
  </div>
);

export const AdminEmpty = ({ message, action }) => (
  <div className="admin-feedback admin-feedback--empty">
    <Inbox aria-hidden="true" />

    <p>{message}</p>

    {action}
  </div>
);
