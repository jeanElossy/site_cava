import { useState } from "react";

import { AnimatePresence, motion } from "framer-motion";
import {
  FaArrowRight,
  FaArrowLeft,
  FaCheck,
} from "react-icons/fa";
import {
  IdCard,
  UserRound,
  Phone,
  HeartHandshake,
  BookOpenText,
  HandHeart,
  ClipboardCheck,
} from "lucide-react";

import { useRegistration } from "../../../context/RegistrationContext";
import { steps, stepMeta, validateStep, buildSubmissionPayload } from "./data";
import { memberSubmissions, churches as churchesApi } from "../../../services/api";
import useAsyncData from "../../../hooks/useAsyncData";

import StepLookup from "./StepLookup";
import StepIdentity from "./StepIdentity";
import StepContact from "./StepContact";
import StepCivilStatus from "./StepCivilStatus";
import StepSpiritualLife from "./StepSpiritualLife";
import StepEngagement from "./StepEngagement";
import StepSummary from "./StepSummary";

import "./RegistrationForm.scss";

// Une icône par étape, dans l'ordre de `steps`/`stepMeta` — le seul
// endroit du tunnel où framework JSX et données se rejoignent, d'où
// sa présence ici plutôt que dans data.js (gardé sans JSX, comme
// ContributionForm/data.js).
const STEP_ICONS = [
  IdCard,
  UserRound,
  Phone,
  HeartHandshake,
  BookOpenText,
  HandHeart,
  ClipboardCheck,
];

const RegistrationForm = () => {
  const { state, dispatch } = useRegistration();

  // Liste des églises chargée UNE SEULE FOIS ici plutôt que dans
  // chaque étape qui en a besoin (StepIdentity pour le select,
  // StepSummary pour le récapitulatif) : les deux consomment la même
  // prop `churchOptions` au lieu de refaire chacune un appel réseau
  // vers /api/churches.
  const { data: churchList } = useAsyncData(churchesApi.list);
  const churchOptions = (churchList ?? []).map((church) => ({
    value: church.number,
    label: church.name,
  }));

  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const isLastStep = step === steps.length - 1;
  const StepIcon = STEP_ICONS[step];

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
        <div className="registration-form__container">
          <div className="registration-form__done">
            <FaCheck aria-hidden="true" />
            <h2>Votre demande a été transmise à l&apos;équipe.</h2>
            <p>
              Un responsable vérifiera votre inscription. Vous
              n&apos;avez rien d&apos;autre à faire pour le moment.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="registration-form" id="registration-form">
      <div className="registration-form__container">
        <p className="registration-form__lead">
          Sept courtes étapes suffisent. Vous pouvez revenir en arrière
          à tout moment, et rien n&apos;est enregistré dans
          l&apos;annuaire des membres tant qu&apos;un responsable
          n&apos;a pas vérifié votre demande.
        </p>

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

        <div className="step-head">
          <span className="step-head__icon">
            <StepIcon aria-hidden="true" />
          </span>

          <div>
            <h2>{stepMeta[step].title}</h2>
            <p>{stepMeta[step].description}</p>
          </div>
        </div>

        <AnimatePresence
          mode="wait"
          initial={false}
        >
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {step === 0 && (
              <StepLookup
                state={state}
                dispatch={dispatch}
                updateData={updateData}
              />
            )}
            {step === 1 && (
              <StepIdentity
                state={state}
                updateData={updateData}
                churchOptions={churchOptions}
              />
            )}
            {step === 2 && (
              <StepContact state={state} updateData={updateData} />
            )}
            {step === 3 && (
              <StepCivilStatus state={state} updateData={updateData} />
            )}
            {step === 4 && (
              <StepSpiritualLife state={state} updateData={updateData} />
            )}
            {step === 5 && (
              <StepEngagement state={state} updateData={updateData} />
            )}
            {step === 6 && (
              <StepSummary state={state} churchOptions={churchOptions} />
            )}
          </motion.div>
        </AnimatePresence>

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
