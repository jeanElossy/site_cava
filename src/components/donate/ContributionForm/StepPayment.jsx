import { paymentMethods } from "./data";

// Étape 3 : choix du moyen de paiement.
const StepPayment = ({ state, dispatch }) => (
  <div className="step-panel">

    <div className="form-group">

      <label id="label-paiement">
        Moyen de paiement
      </label>

      <div
        className="payment-grid"
        role="group"
        aria-labelledby="label-paiement"
      >

        {paymentMethods.map((payment) => (
          <button
            type="button"
            key={payment.value}
            className={
              state.paymentMethod === payment.value
                ? "active"
                : ""
            }
            aria-pressed={
              state.paymentMethod === payment.value
            }
            onClick={() =>
              dispatch({
                type: "SET_PAYMENT_METHOD",
                payload: payment.value,
              })
            }
          >
            <div className="payment-logo-wrapper">
              <img
                src={payment.logo}
                alt=""
                aria-hidden="true"
                className="payment-logo"
              />
            </div>

            <span>{payment.label}</span>
          </button>
        ))}

      </div>

    </div>

  </div>
);

export default StepPayment;
