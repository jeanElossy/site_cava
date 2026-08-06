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
                    },
                  })
                }
              >
                <div className="payment-logo-wrapper">
                  {method.image?.url && (
                    <img src={method.image.url} alt="" aria-hidden="true" className="payment-logo" />
                  )}
                </div>

                <span>{method.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default StepPaymentMethod;
