import { Link } from "react-router-dom";

import { FaArrowRight, FaLock } from "react-icons/fa";

import ImpactCard from "../ImpactSection";

import {
  contributionTypeLabel,
  paymentLabel,
  projectLabel,
} from "./data";

// Récapitulatif collant, visible à toutes les étapes.
// Le bouton de paiement n'apparaît qu'à la dernière.
const SummaryCard = ({
  state,
  isLastStep,
  onSubmit,
  showNotice,
}) => {
  const amount = Number(
    state.amount || 0
  ).toLocaleString();

  return (
    <aside className="summary-card">

      <h3>Résumé</h3>

      <div className="summary-row">
        <span>Type</span>
        <strong>
          {contributionTypeLabel(
            state.contributionType
          )}
        </strong>
      </div>

      <div className="summary-row">
        <span>Fréquence</span>
        <strong>
          {state.recurring ? "Mensuelle" : "Unique"}
        </strong>
      </div>

      <div className="summary-row">
        <span>Affectation</span>
        <strong>{projectLabel(state.project)}</strong>
      </div>

      <div className="summary-row">
        <span>Paiement</span>
        <strong>
          {paymentLabel(state.paymentMethod)}
        </strong>
      </div>

      <div className="summary-total">
        <span>Total</span>
        <strong>{amount} FCFA</strong>
      </div>

      <ImpactCard />

      {isLastStep && (
        <button
          type="button"
          className="pay-btn"
          onClick={onSubmit}
        >
          <FaLock aria-hidden="true" />

          Continuer le paiement

          <FaArrowRight aria-hidden="true" />
        </button>
      )}

      {showNotice && (
        <div
          className="pay-notice"
          role="status"
          aria-live="polite"
        >
          <p>
            Le paiement en ligne n'est pas encore actif
            sur le site.
          </p>

          <p>
            Pour finaliser votre contribution de{" "}
            <strong>{amount} FCFA</strong>,
            contactez-nous : nous vous communiquerons
            les coordonnées de versement.
          </p>

          <Link to="/contact">
            Nous contacter
            <FaArrowRight aria-hidden="true" />
          </Link>
        </div>
      )}

    </aside>
  );
};

export default SummaryCard;
