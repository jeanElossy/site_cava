import { ArrowRight, Loader2 } from "lucide-react";

import ImpactCard from "../ImpactSection";

// Récapitulatif collant, visible à toutes les étapes. Le bouton final
// ("J'ai effectué le paiement") n'apparaît qu'à l'étape du billet.
const SummaryCard = ({ state, step, submitting, submitError, onProceedToProof }) => {
  const amount = Number(state.amount || 0).toLocaleString("fr-FR");
  const showTicketAction = step === 2;

  return (
    <aside className="summary-card">

      <h3>Résumé</h3>

      <div className="summary-row">
        <span>Type</span>
        <strong>{state.donationType.name || "—"}</strong>
      </div>

      <div className="summary-row">
        <span>Paiement</span>
        <strong>{state.paymentMethod.name || "—"}</strong>
      </div>

      <div className="summary-total">
        <span>Total</span>
        <strong>{amount} FCFA</strong>
      </div>

      <ImpactCard />

      {showTicketAction && (
        <>
          <button
            type="button"
            className="pay-btn"
            onClick={onProceedToProof}
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="pay-btn__spinner" aria-hidden="true" />
            ) : (
              <>
                J'ai effectué le paiement
                <ArrowRight aria-hidden="true" />
              </>
            )}
          </button>

          {submitError && (
            <p className="step-error" role="alert">{submitError}</p>
          )}
        </>
      )}

    </aside>
  );
};

export default SummaryCard;
