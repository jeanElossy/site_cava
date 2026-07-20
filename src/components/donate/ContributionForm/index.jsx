import { useState } from "react";

import {
  FaArrowRight,
  FaArrowLeft,
  FaCheck,
} from "react-icons/fa";

import {
  useContribution,
} from "../../../context/ContributionContext";

import { steps, validateStep } from "./data";

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
  const [showNotice, setShowNotice] = useState(false);

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
    setShowNotice(false);
    setStep((current) => Math.max(current - 1, 0));
  };

  // Aucun prestataire de paiement n'est branché (site statique, pas de
  // backend). On ne simule surtout pas une transaction réussie : on
  // informe honnêtement et on oriente vers un canal réel.
  //
  // À faire quand un backend existera : brancher ici les API Orange
  // Money, MTN, Moov, Wave et carte bancaire, puis afficher une vraie
  // confirmation avec la référence de transaction renvoyée par l'API.
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
          showNotice={showNotice}
        />

      </div>

    </section>
  );
};

export default ContributionForm;
