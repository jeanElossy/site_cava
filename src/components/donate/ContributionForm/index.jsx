import { useEffect, useState } from "react";

import {
  FaArrowRight,
  FaArrowLeft,
  FaCheck,
} from "react-icons/fa";

import {
  useContribution,
} from "../../../context/ContributionContext";

import { steps, validateStep } from "./data";

import {
  paymentConfig,
  startDonation,
} from "../../../services/donations";

import StepAmount from "./StepAmount";
import StepDonor from "./StepDonor";
import StepPayment from "./StepPayment";
import SummaryCard from "./SummaryCard";

import "./ContributionForm.scss";

// Ce composant ne porte plus que l'orchestration du tunnel :
// l'étape courante, la validation et la navigation. Les données et
// les libellés sont dans `data.js`, chaque étape dans son fichier,
// le récapitulatif dans `SummaryCard.jsx`.
const ContributionForm = () => {
  const { state, dispatch } = useContribution();

  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // `null` tant que la réponse du serveur n'est pas arrivée : on
  // n'affiche ni le bouton de paiement ni le message « pas encore
  // actif » avant de savoir lequel des deux est vrai.
  const [paymentEnabled, setPaymentEnabled] = useState(null);

  useEffect(() => {
    let cancelled = false;

    paymentConfig()
      .then((config) => {
        if (!cancelled) setPaymentEnabled(config?.enabled === true);
      })
      .catch(() => {
        // API injoignable : on retombe sur le message de repli, qui
        // oriente vers un canal humain. Bien préférable à un bouton
        // qui ne mènerait nulle part.
        if (!cancelled) setPaymentEnabled(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const isLastStep = step === steps.length - 1;

  const clearError = () => {
    if (error) setError("");
  };

  const updateDonor = (field, value) => {
    dispatch({
      type: "UPDATE_DONOR",
      payload: { [field]: value },
    });

    clearError();
  };

  const goNext = () => {
    const message = validateStep(step, state);

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
    setStep((current) => Math.max(current - 1, 0));
  };

  // Départ vers le guichet de paiement.
  //
  // Le serveur enregistre l'intention, fige le montant, puis renvoie
  // l'URL du prestataire. On ne fait que suivre cette URL : le montant
  // qui sera débité n'est plus modifiable côté navigateur à partir
  // d'ici.
  //
  // `location.href` plutôt qu'une navigation React : la destination est
  // un autre domaine, hors du routeur.
  const handleSubmit = async () => {
    if (submitting) return;

    setError("");
    setSubmitting(true);

    try {
      const { paymentUrl } = await startDonation({
        amount: state.amount,
        contributionType: state.contributionType,
        project: state.project,
        recurring: state.recurring,
        paymentMethod: state.paymentMethod,
        donor: state.donor,
      });

      window.location.href = paymentUrl;
    } catch (submitError) {
      // L'erreur peut porter un détail par champ (montant refusé,
      // carte sans coordonnées…). On affiche le plus précis disponible.
      const details = submitError.details
        ? Object.values(submitError.details)[0]
        : null;

      setError(
        details ??
          submitError.message ??
          "Le paiement n'a pas pu être lancé. Merci de réessayer."
      );

      setSubmitting(false);
    }
  };

  return (
    <section
      className="contribution-form"
      id="contribution-form"
    >

      <div className="contribution-form__container">

        <div className="contribution-form__left">

          <h2>Votre contribution</h2>

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

          {step === 0 && (
            <StepAmount
              state={state}
              dispatch={dispatch}
              onEdit={clearError}
            />
          )}

          {step === 1 && (
            <StepDonor
              state={state}
              updateDonor={updateDonor}
            />
          )}

          {step === 2 && (
            <StepPayment
              state={state}
              dispatch={dispatch}
            />
          )}

          {error && (
            <p className="step-error" role="alert">
              {error}
            </p>
          )}

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

            {!isLastStep && (
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

        <SummaryCard
          state={state}
          isLastStep={isLastStep}
          onSubmit={handleSubmit}
          submitting={submitting}
          paymentEnabled={paymentEnabled === true}
        />

      </div>

    </section>
  );
};

export default ContributionForm;
