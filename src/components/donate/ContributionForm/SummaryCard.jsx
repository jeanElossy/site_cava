import { Link } from "react-router-dom";

import {
  FaArrowRight,
  FaLock,
  FaSpinner,
  FaShieldAlt,
} from "react-icons/fa";

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
  submitting,
  paymentEnabled,
}) => {
  const amount = Number(state.amount || 0).toLocaleString("fr-FR");

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

      {isLastStep && paymentEnabled && (
        <>
          <button
            type="button"
            className="pay-btn"
            onClick={onSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <FaSpinner
                  className="pay-btn__spinner"
                  aria-hidden="true"
                />
                Redirection en cours…
              </>
            ) : (
              <>
                <FaLock aria-hidden="true" />
                Continuer le paiement
                <FaArrowRight aria-hidden="true" />
              </>
            )}
          </button>

          {/* Le donateur quitte le site pour payer : le dire avant le
              clic, plutôt que de le laisser croire à une page piratée
              en découvrant un autre domaine dans sa barre d'adresse. */}
          <p className="pay-reassurance">
            <FaShieldAlt aria-hidden="true" />

            <span>
              Vous serez redirigé vers notre prestataire de paiement
              sécurisé. Vos coordonnées bancaires ne transitent jamais
              par notre site.
            </span>
          </p>
        </>
      )}

      {/* Tant que le compte marchand n'est pas ouvert, on l'annonce
          honnêtement au lieu de simuler une transaction. */}
      {isLastStep && !paymentEnabled && (
        <div
          className="pay-notice"
          role="status"
          aria-live="polite"
        >
          <p>
            Le paiement en ligne n'est pas encore actif sur le site.
          </p>

          <p>
            Pour finaliser votre contribution de{" "}
            <strong>{amount} FCFA</strong>, contactez-nous : nous vous
            communiquerons les coordonnées de versement.
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
