import { useState } from "react";

import { FaArrowRight, FaArrowLeft, FaCheck } from "react-icons/fa";

import { useRegistration } from "../../../context/RegistrationContext";
import { steps, validateStep, buildSubmissionPayload } from "./data";
import { memberSubmissions } from "../../../services/api";

import StepLookup from "./StepLookup";
import StepIdentity from "./StepIdentity";
import StepContact from "./StepContact";
import StepCivilStatus from "./StepCivilStatus";
import StepSpiritualLife from "./StepSpiritualLife";
import StepEngagement from "./StepEngagement";
import StepSummary from "./StepSummary";

import "./RegistrationForm.scss";

const RegistrationForm = () => {
  const { state, dispatch } = useRegistration();

  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const isLastStep = step === steps.length - 1;

  const clearError = () => {
    if (error) setError("");
  };

  const updateData = (patch) => {
    dispatch({ type: "UPDATE_DATA", payload: patch });
    clearError();
  };

  const goNext = () => {
    const message = validateStep(step, state);

    if (message) {
      setError(message);

      return;
    }

    setError("");
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const goBack = () => {
    setError("");
    setStep((current) => Math.max(current - 1, 0));
  };

  const handleSubmit = async () => {
    if (submitting) return;

    setError("");
    setSubmitting(true);

    try {
      await memberSubmissions.submit(buildSubmissionPayload(state));

      setSubmitted(true);
    } catch (submitError) {
      const details = submitError.details
        ? Object.values(submitError.details)[0]
        : null;

      setError(
        details ??
          submitError.message ??
          "L'envoi a échoué. Merci de réessayer."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section className="registration-form">
        <div className="registration-form__done">
          <FaCheck aria-hidden="true" />
          <h2>Votre demande a été transmise à l&apos;équipe.</h2>
          <p>
            Un responsable vérifiera votre inscription. Vous
            n&apos;avez rien d&apos;autre à faire pour le moment.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="registration-form" id="registration-form">
      <div className="registration-form__container">
        <ol className="steps" aria-label="Étapes de l'inscription">
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
              aria-current={index === step ? "step" : undefined}
            >
              <span className="steps__bullet">
                {index < step ? (
                  <FaCheck aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </span>

              <span className="steps__label">{label}</span>
            </li>
          ))}
        </ol>

        {step === 0 && <StepLookup state={state} dispatch={dispatch} />}
        {step === 1 && (
          <StepIdentity state={state} updateData={updateData} />
        )}
        {step === 2 && <StepContact state={state} updateData={updateData} />}
        {step === 3 && (
          <StepCivilStatus state={state} updateData={updateData} />
        )}
        {step === 4 && (
          <StepSpiritualLife state={state} updateData={updateData} />
        )}
        {step === 5 && (
          <StepEngagement state={state} updateData={updateData} />
        )}
        {step === 6 && <StepSummary state={state} />}

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

          {isLastStep && (
            <button
              type="button"
              className="step-nav__next"
              onClick={handleSubmit}
              disabled={submitting}
              aria-busy={submitting}
            >
              {submitting ? "Envoi…" : "Envoyer ma demande"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

export default RegistrationForm;
