import { useState } from "react";

import { Link } from "react-router-dom";

import "./ContributionForm.scss";

import {
  FaArrowRight,
  FaArrowLeft,
  FaLock,
  FaCheck,
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

// Le parcours est découpé en 3 étapes plutôt qu'un formulaire d'un seul
// tenant : chaque étape reste courte sur mobile, et l'intégration future
// d'un prestataire de paiement se branche naturellement sur la dernière.
const steps = [
  "Montant",
  "Informations",
  "Paiement",
];

// Le contexte ne stocke que l'identifiant du type ("grace", "dime"…).
// Le résumé doit afficher le libellé lisible, pas l'identifiant brut.
const contributionTypeLabels = {
  dime: "Dîme",
  offrande: "Offrande",
  don: "Don",
  grace: "Action de grâce",
  projet: "Projet spécial",
};

const contributionTypeLabel = (value) =>
  contributionTypeLabels[value] ?? value;

const projectLabel = (value) =>
  projects.find((p) => p.value === value)?.label ??
  value;

const paymentLabel = (value) =>
  paymentMethods.find((p) => p.value === value)
    ?.label ?? value;

const ContributionForm = () => {
  const { state, dispatch } =
    useContribution();

  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [showNotice, setShowNotice] =
    useState(false);

  const updateDonor = (field, value) => {
    dispatch({
      type: "UPDATE_DONOR",
      payload: {
        [field]: value,
      },
    });

    if (error) {
      setError("");
    }
  };

  // Validation minimale par étape : on ne laisse pas avancer avec un
  // montant vide ou sans moyen de recontacter le donateur.
  const validateStep = () => {
    if (step === 0) {
      if (!state.amount || state.amount <= 0) {
        return "Merci d'indiquer un montant supérieur à zéro.";
      }
    }

    if (step === 1 && !state.donor.anonymous) {
      if (!state.donor.firstName.trim()) {
        return "Merci d'indiquer votre prénom, ou de cocher « Contribution anonyme ».";
      }

      if (!state.donor.phone.trim()) {
        return "Merci d'indiquer un téléphone pour confirmer votre contribution.";
      }
    }

    return "";
  };

  const goNext = () => {
    const message = validateStep();

    if (message) {
      setError(message);

      return;
    }

    setError("");
    setStep((current) =>
      Math.min(current + 1, steps.length - 1)
    );
  };

  const goBack = () => {
    setError("");
    setShowNotice(false);
    setStep((current) => Math.max(current - 1, 0));
  };

  // Aucun prestataire de paiement n'est branché (site statique, pas de
  // backend). On ne simule surtout pas une transaction réussie : on
  // informe honnêtement et on oriente vers un canal réel.
  //
  // À faire quand un backend existera : brancher ici les API Orange Money,
  // MTN, Moov, Wave et carte bancaire, puis afficher
  // `ContributionSuccessModal` avec la vraie référence de transaction.
  const handleSubmit = () => {
    setShowNotice(true);
  };

  return (
    <section
      className="contribution-form"
      id="contribution-form"
    >

      <div className="contribution-form__container">

        <div className="contribution-form__left">

          <h2>Votre contribution</h2>

          {/* PROGRESSION */}

          <ol
            className="steps"
            aria-label="Étapes de la contribution"
          >
            {steps.map((label, index) => (
              <li
                key={label}
                className={
                  index === step
                    ? "steps__item steps__item--current"
                    : index < step
                      ? "steps__item steps__item--done"
                      : "steps__item"
                }
                aria-current={
                  index === step ? "step" : undefined
                }
              >
                <span className="steps__bullet">
                  {index < step ? (
                    <FaCheck aria-hidden="true" />
                  ) : (
                    index + 1
                  )}
                </span>

                <span className="steps__label">
                  {label}
                </span>
              </li>
            ))}
          </ol>

          {/* ETAPE 1 — MONTANT */}

          {step === 0 && (
            <div className="step-panel">

              <div className="form-group">

                <label id="label-frequence">
                  Fréquence
                </label>

                <div
                  className="frequency-grid"
                  role="group"
                  aria-labelledby="label-frequence"
                >

                  <button
                    type="button"
                    className={
                      !state.recurring ? "active" : ""
                    }
                    aria-pressed={!state.recurring}
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
                      state.recurring ? "active" : ""
                    }
                    aria-pressed={state.recurring}
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

              <div className="form-group">

                <label
                  id="label-montant"
                  htmlFor="montant-libre"
                >
                  Montant
                </label>

                <div
                  className="amount-grid"
                  role="group"
                  aria-labelledby="label-montant"
                >

                  {amounts.map((amount) => (
                    <button
                      type="button"
                      key={amount}
                      className={
                        state.amount === amount
                          ? "active"
                          : ""
                      }
                      aria-pressed={
                        state.amount === amount
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
                  id="montant-libre"
                  type="number"
                  min="0"
                  value={state.amount}
                  placeholder="Autre montant"
                  onChange={(e) => {
                    dispatch({
                      type: "SET_AMOUNT",
                      payload: e.target.value,
                    });

                    if (error) {
                      setError("");
                    }
                  }}
                />

              </div>

              <div className="form-group">

                <label htmlFor="affectation">
                  Affectation
                </label>

                <select
                  id="affectation"
                  value={state.project}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_PROJECT",
                      payload: e.target.value,
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

            </div>
          )}

          {/* ETAPE 2 — INFORMATIONS */}

          {step === 1 && (
            <div className="step-panel">

              <div className="form-group">

                <label>Vos informations</label>

                <div className="donor-grid">

                  <input
                    placeholder="Prénom"
                    aria-label="Prénom"
                    autoComplete="given-name"
                    value={state.donor.firstName}
                    onChange={(e) =>
                      updateDonor(
                        "firstName",
                        e.target.value
                      )
                    }
                  />

                  <input
                    placeholder="Nom"
                    aria-label="Nom"
                    autoComplete="family-name"
                    value={state.donor.lastName}
                    onChange={(e) =>
                      updateDonor(
                        "lastName",
                        e.target.value
                      )
                    }
                  />

                  <input
                    placeholder="Téléphone"
                    aria-label="Téléphone"
                    autoComplete="tel"
                    value={state.donor.phone}
                    onChange={(e) =>
                      updateDonor(
                        "phone",
                        e.target.value
                      )
                    }
                  />

                  <input
                    placeholder="Email"
                    aria-label="Email"
                    type="email"
                    autoComplete="email"
                    value={state.donor.email}
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
                    checked={state.donor.anonymous}
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

            </div>
          )}

          {/* ETAPE 3 — PAIEMENT */}

          {step === 2 && (
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
                        state.paymentMethod ===
                        payment.value
                          ? "active"
                          : ""
                      }
                      aria-pressed={
                        state.paymentMethod ===
                        payment.value
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
          )}

          {error && (
            <p
              className="step-error"
              role="alert"
            >
              {error}
            </p>
          )}

          {/* NAVIGATION */}

          <div className="step-nav">

            {step > 0 && (
              <button
                type="button"
                className="step-nav__back"
                onClick={goBack}
              >
                <FaArrowLeft aria-hidden="true" />
                Retour
              </button>
            )}

            {step < steps.length - 1 && (
              <button
                type="button"
                className="step-nav__next"
                onClick={goNext}
              >
                Suivant
                <FaArrowRight aria-hidden="true" />
              </button>
            )}

          </div>

        </div>

        {/* RESUME */}

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
              {state.recurring
                ? "Mensuelle"
                : "Unique"}
            </strong>
          </div>

          <div className="summary-row">
            <span>Affectation</span>
            <strong>
              {projectLabel(state.project)}
            </strong>
          </div>

          <div className="summary-row">
            <span>Paiement</span>
            <strong>
              {paymentLabel(state.paymentMethod)}
            </strong>
          </div>

          <div className="summary-total">
            <span>Total</span>
            <strong>
              {Number(
                state.amount || 0
              ).toLocaleString()}{" "}
              FCFA
            </strong>
          </div>

          <ImpactCard />

          {/* Le paiement ne s'ouvre qu'à la dernière étape. */}
          {step === steps.length - 1 && (
            <button
              type="button"
              className="pay-btn"
              onClick={handleSubmit}
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
                Le paiement en ligne n'est pas encore
                actif sur le site.
              </p>

              <p>
                Pour finaliser votre contribution de{" "}
                <strong>
                  {Number(
                    state.amount || 0
                  ).toLocaleString()}{" "}
                  FCFA
                </strong>
                , contactez-nous : nous vous
                communiquerons les coordonnées de
                versement.
              </p>

              <Link to="/contact">
                Nous contacter
                <FaArrowRight aria-hidden="true" />
              </Link>
            </div>
          )}

        </aside>

      </div>

    </section>
  );
};

export default ContributionForm;
