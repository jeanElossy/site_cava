import { ArrowRight, Loader2 } from "lucide-react";

import ImpactCard from "../ImpactSection";

// Récapitulatif collant, visible à toutes les étapes. Le bouton final
// ("J'ai effectué le paiement") n'apparaît qu'à l'étape du billet.
//
// Ne porte plus d'erreur d'envoi : `submitError` ne vient que du
// bouton « Envoyer » de la dernière étape (voir `index.jsx`), sans
// rapport avec le bouton affiché ici à l'étape du billet — l'afficher
// ici l'aurait fait réapparaître, obsolète, en quittant l'étape
// d'envoi vers l'étape du billet (voir `goBack` dans `index.jsx`).
const SummaryCard = ({ state, step, submitting, onProceedToProof }) => {
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
      )}

    </aside>
  );
};

export default SummaryCard;
