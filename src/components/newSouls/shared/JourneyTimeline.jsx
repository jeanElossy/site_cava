import { Check } from "lucide-react";

import { STATUS_LABELS } from "./statusLabels";

import "./NewSouls.scss";

const STATUS_ORDER = Object.keys(STATUS_LABELS);

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
    : null;

// Parcours RÉEL de ce dossier (contrairement au bandeau "Aperçu du
// processus" du wizard SOA, purement illustratif) : l'étape atteinte
// et les dates de passage viennent de `statusHistory`, tenu à jour par
// `applyStatus` côté serveur à chaque transition.
const JourneyTimeline = ({ status, statusHistory = [] }) => {
  const currentIndex = STATUS_ORDER.indexOf(status);

  const dateByStatus = new Map(
    statusHistory.map((entry) => [entry.status, entry.changedAt])
  );

  return (
    <div className="new-soul-journey" role="list" aria-label="Parcours du dossier">
      {STATUS_ORDER.map((value, index) => {
        const done = index < currentIndex;
        const current = index === currentIndex;
        const date = formatDate(dateByStatus.get(value));

        return (
          <div
            key={value}
            role="listitem"
            className={`new-soul-journey__step${done ? " new-soul-journey__step--done" : ""}${
              current ? " new-soul-journey__step--current" : ""
            }`}
          >
            <span className="new-soul-journey__dot">
              {done ? <Check size={12} aria-hidden="true" /> : index + 1}
            </span>

            <span className="new-soul-journey__label">{STATUS_LABELS[value]}</span>

            {date && <span className="new-soul-journey__date">{date}</span>}
          </div>
        );
      })}
    </div>
  );
};

export default JourneyTimeline;
