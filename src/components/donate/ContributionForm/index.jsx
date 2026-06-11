import "./ContributionForm.scss";

import {
  FaArrowRight,
  FaCreditCard,
  FaMobileAlt,
  FaLock,
} from "react-icons/fa";

import {
  useContribution,
} from "../../../context/ContributionContext";

import ImpactCard from "../ImpactSection";


import OrangeMoneyLogo from "../../../assets/images/orange-money.png";
import MTNMoneyLogo from "../../../assets/images/mtn-money.jpg";
import MoovMoneyLogo from "../../../assets/images/moov-money.png";
import WaveLogo from "../../../assets/images/wave.jpg";
import VisaMastercardLogo from "../../../assets/images/visa.png";



const amounts = [
  5000,
  10000,
  20000,
  50000,
  100000,
];

const projects = [
  {
    value: "general",
    label: "🏠 Œuvre Générale",
  },
  {
    value: "evangelisation",
    label: "🌍 Évangélisation",
  },
  {
    value: "social",
    label: "🤝 Action Sociale",
  },
  {
    value: "formation",
    label: "📖 Formation Biblique",
  },
  {
    value: "media",
    label: "🎤 Média & Streaming",
  },
  {
    value: "construction",
    label: "🏗 Construction",
  },
];

const paymentMethods = [
  {
    value: "orange",
    label: "Orange Money",
    logo: OrangeMoneyLogo,
  },
  {
    value: "mtn",
    label: "MTN Money",
    logo: MTNMoneyLogo,
  },
  {
    value: "moov",
    label: "Moov Money",
    logo: MoovMoneyLogo,
  },
  {
    value: "wave",
    label: "Wave",
    logo: WaveLogo,
  },
  {
    value: "card",
    label: "Visa / Mastercard",
    logo: VisaMastercardLogo,
  },
];


const ContributionForm = () => {
  const { state, dispatch } =
    useContribution();

  const updateDonor = (
    field,
    value
  ) => {
    dispatch({
      type: "UPDATE_DONOR",
      payload: {
        [field]: value,
      },
    });
  };

  const handleSubmit = () => {
    console.log(state);

    // API Orange
    // API MTN
    // API Wave
    // API Carte
  };

  return (
    <section className="contribution-form">

      <div className="contribution-form__container">

        <div className="contribution-form__left">

          <h2>
            Votre contribution
          </h2>

          {/* FREQUENCE */}

          <div className="form-group">

            <label>
              Fréquence
            </label>

            <div className="frequency-grid">

              

              <button
                type="button"
                className={
                  !state.recurring
                    ? "active"
                    : ""
                }
                onClick={() =>
                  dispatch({
                    type: "SET_RECURRING",
                    payload: false,
                  })
                }
              >
                Unique
              </button>

              <button
                type="button"
                className={
                  state.recurring
                    ? "active"
                    : ""
                }
                onClick={() =>
                  dispatch({
                    type: "SET_RECURRING",
                    payload: true,
                  })
                }
              >
                Mensuelle
              </button>

            </div>

          </div>

          {/* MONTANTS */}

          <div className="form-group">

            <label>
              Montant
            </label>

            <div className="amount-grid">

              {amounts.map((amount) => (
                <button
                  type="button"
                  key={amount}
                  className={
                    state.amount === amount
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    dispatch({
                      type: "SET_AMOUNT",
                      payload: amount,
                    })
                  }
                >
                  {amount.toLocaleString()}
                </button>
              ))}

            </div>

            <input
              type="number"
              value={state.amount}
              placeholder="Autre montant"
              onChange={(e) =>
                dispatch({
                  type: "SET_AMOUNT",
                  payload:
                    e.target.value,
                })
              }
            />

          </div>

          {/* PROJET */}

          <div className="form-group">

            <label>
              Affectation
            </label>

            <select
              value={state.project}
              onChange={(e) =>
                dispatch({
                  type: "SET_PROJECT",
                  payload:
                    e.target.value,
                })
              }
            >

              {projects.map((project) => (
                <option
                  key={project.value}
                  value={project.value}
                >
                  {project.label}
                </option>
              ))}

            </select>

          </div>

          {/* DONATEUR */}

          <div className="form-group">

            <label>
              Informations
            </label>

            <div className="donor-grid">

              <input
                placeholder="Prénom"
                value={
                  state.donor
                    .firstName
                }
                onChange={(e) =>
                  updateDonor(
                    "firstName",
                    e.target.value
                  )
                }
              />

              <input
                placeholder="Nom"
                value={
                  state.donor.lastName
                }
                onChange={(e) =>
                  updateDonor(
                    "lastName",
                    e.target.value
                  )
                }
              />

              <input
                placeholder="Téléphone"
                value={
                  state.donor.phone
                }
                onChange={(e) =>
                  updateDonor(
                    "phone",
                    e.target.value
                  )
                }
              />

              <input
                placeholder="Email"
                value={
                  state.donor.email
                }
                onChange={(e) =>
                  updateDonor(
                    "email",
                    e.target.value
                  )
                }
              />

            </div>

            <label className="checkbox">

              <input
                type="checkbox"
                checked={
                  state.donor
                    .anonymous
                }
                onChange={(e) =>
                  updateDonor(
                    "anonymous",
                    e.target.checked
                  )
                }
              />

              Contribution anonyme

            </label>

          </div>

          {/* PAIEMENT */}

          <div className="form-group">

            <label>
              Moyen de paiement
            </label>

            <div className="payment-grid">

              {paymentMethods.map(
                (payment) => (
                  <button
                    type="button"
                    key={payment.value}
                    className={
                      state.paymentMethod ===
                      payment.value
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      dispatch({
                        type:
                          "SET_PAYMENT_METHOD",
                        payload:
                          payment.value,
                      })
                    }
                  >
                    <div className="payment-logo-wrapper">
                      <img
                        src={payment.logo}
                        alt={payment.label}
                        className="payment-logo"
                      />
                    </div>

                    <span>{payment.label}</span>
                  </button>
                )
              )}

            </div>

          </div>

        </div>

        {/* RESUME */}

        <aside className="summary-card">

          <h3>
            Résumé
          </h3>

          <div className="summary-row">
            <span>Type</span>

            <strong>
              {
                state.contributionType
              }
            </strong>
          </div>

          <div className="summary-row">
            <span>
              Fréquence
            </span>

            <strong>
              {state.recurring
                ? "Mensuelle"
                : "Unique"}
            </strong>
          </div>

          <div className="summary-row">
            <span>
              Montant
            </span>

            <strong>
              {state.amount.toLocaleString()} FCFA
            </strong>
          </div>

          <div className="summary-row">
            <span>
              Paiement
            </span>

            <strong>
              {
                state.paymentMethod
              }
            </strong>
          </div>

          <div className="summary-total">

            <span>Total</span>

            <strong>
              {state.amount.toLocaleString()} FCFA
            </strong>

          </div>

          <ImpactCard />

          <button
            type="button"
            className="pay-btn"
            onClick={handleSubmit}
          >
            <FaLock />

            Continuer le paiement

            <FaArrowRight />
          </button>

        </aside>

      </div>

    </section>
  );
};

export default ContributionForm;