import useAsyncData from "../../../hooks/useAsyncData";
import { fetchPaymentMethods } from "../../../services/donations";

// Étape 2 : choix du moyen de paiement — la « pousse » du parcours.
const StepPaymentMethod = ({ state, dispatch }) => {
  const { data: methods, loading, error } = useAsyncData(fetchPaymentMethods);

  return (
    <div className="step-panel">

      <div className="form-group">
        <label id="label-paiement">Moyen de paiement</label>

        {loading && <p className="step-panel__hint">Chargement des moyens de paiement…</p>}
        {error && <p className="step-panel__hint step-panel__hint--error">{error}</p>}

        {methods && methods.length === 0 && (
          <p className="step-panel__hint step-panel__hint--error">
            Aucun moyen de paiement n'est actif pour le moment. Merci de nous contacter directement.
          </p>
        )}

        {methods && methods.length > 0 && (
          <div className="payment-grid" role="group" aria-labelledby="label-paiement">
            {methods.map((method) => (
              <button
                type="button"
                key={method.id}
                className={state.paymentMethod.id === method.id ? "active" : ""}
                aria-pressed={state.paymentMethod.id === method.id}
                onClick={() =>
                  dispatch({
                    type: "SET_PAYMENT_METHOD",
                    payload: {
                      id: method.id,
                      name: method.name,
                      image: method.image?.url ?? "",
                      // Repris jusqu'au billet d'offrande : c'est le
                      // recours du donateur qui ne peut pas scanner le
                      // QR (voir StepQrTicket).
                      accountNumber: method.accountNumber ?? "",
                      holderName: method.holderName ?? "",
                    },
                  })
                }
              >
                {/* Aucune vignette ici : `image` n'est pas un logo de
                    marque mais le QR code Mobile Money lui-même.
                    Réduit à 24 px, il ne donnait qu'un damier
                    illisible. Sa place est à l'étape du billet, à une
                    taille scannable. */}
                <span>{method.name}</span>

                {method.accountNumber && (
                  <span className="payment-account">{method.accountNumber}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default StepPaymentMethod;
