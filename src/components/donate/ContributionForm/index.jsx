import { useState } from "react";

import { ArrowLeft, ArrowRight, Check, Sprout, Leaf, Wheat, Send, Loader2 } from "lucide-react";

import { useContribution } from "../../../context/useContribution";

import { steps, validateStep } from "./data";
import { submitDonation } from "../../../services/donations";

import StepIdentity from "./StepIdentity";
import StepPaymentMethod from "./StepPaymentMethod";
import StepQrTicket from "./StepQrTicket";
import StepProof from "./StepProof";
import SummaryCard from "./SummaryCard";

import "./ContributionForm.scss";

// Icônes de croissance associées à chaque étape — écho au nom « Vie
// et Abondance » et à l'image biblique de la semence (voir la
// section Design visuel de la spec), pas une simple numérotation.
const STEP_ICONS = [Sprout, Leaf, Leaf, Wheat];

// Ce composant ne porte plus que l'orchestration du tunnel à 4
// étapes : identité/montant/type → moyen de paiement → QR à scanner
// → preuve. Aucune redirection externe : le don est créé directement
// depuis l'étape 4, avec la preuve déjà fournie.
const ContributionForm = () => {
  const { state, dispatch } = useContribution();

  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [reference, setReference] = useState("");

  const isLastStep = step === steps.length - 1;

  const clearError = () => {
    if (error) setError("");
  };

  const updateDonor = (field, value) => {
    dispatch({ type: "UPDATE_DONOR", payload: { [field]: value } });
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
    // Une erreur de soumission (`submitError`) n'a de sens qu'au regard
    // du bouton « Envoyer » de la dernière étape : la laisser vivante en
    // quittant cette étape la ferait réapparaître, sans rapport, à côté
    // du bouton « J'ai effectué le paiement » de l'étape QR (step === 2,
    // voir SummaryCard).
    setSubmitError("");
    setStep((current) => Math.max(current - 1, 0));
  };

  // Depuis l'étape « QR à scanner », le bouton « J'ai effectué le
  // paiement » avance simplement vers l'étape preuve — aucun appel
  // réseau ici, la création du don n'a lieu qu'à la soumission finale.
  const handleProceedToProof = () => goNext();

  const handleSubmit = async () => {
    const message = validateStep(step, state);

    if (message) {
      setError(message);
      return;
    }

    // Une validation réussie efface toute ancienne erreur de validation
    // (`error`) qui pourrait sinon rester affichée aux côtés de l'état
    // d'envoi, en plus de repartir sur une tentative d'envoi propre.
    setError("");
    setSubmitError("");
    setSubmitting(true);

    try {
      const result = await submitDonation({
        donor: state.donor,
        amount: state.amount,
        donationTypeId: state.donationType.id,
        paymentMethodId: state.paymentMethod.id,
        proof: state.proof,
      });

      setReference(result.reference);
    } catch (caught) {
      const details = caught.details ? Object.values(caught.details)[0] : null;

      setSubmitError(
        details ?? caught.message ?? "Votre don n'a pas pu être enregistré. Merci de réessayer."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (reference) {
    return (
      <section className="contribution-form contribution-form--done" id="contribution-form">
        <div className="contribution-form__confirmation">
          <Check size={40} aria-hidden="true" />
          <h2>Merci pour votre don !</h2>
          <p>
            Votre contribution est enregistrée et en attente de vérification. Conservez votre
            référence : <strong>{reference}</strong>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="contribution-form" id="contribution-form">

      <div className="contribution-form__container">

        <div className="contribution-form__left">

          <h2>Votre contribution</h2>

          <ol className="steps" aria-label="Étapes du don">
            {steps.map((label, index) => {
              const Icon = STEP_ICONS[index];

              return (
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
                    {index < step ? <Check aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}
                  </span>

                  <span className="steps__label">{label}</span>
                </li>
              );
            })}
          </ol>

          {step === 0 && (
            <StepIdentity state={state} dispatch={dispatch} updateDonor={updateDonor} onEdit={clearError} />
          )}

          {step === 1 && <StepPaymentMethod state={state} dispatch={dispatch} />}

          {step === 2 && <StepQrTicket state={state} />}

          {step === 3 && <StepProof state={state} dispatch={dispatch} />}

          {error && (
            <p className="step-error" role="alert">{error}</p>
          )}

          {/* `submitError` ne vient que de `handleSubmit`, déclenché
              uniquement par le bouton « Envoyer » de la dernière étape :
              l'afficher ici, à côté de ce bouton, plutôt que dans
              `SummaryCard` (qui restait monté à l'étape 2 avec un
              message obsolète, sans rapport avec le bouton qui y est
              affiché). */}
          {isLastStep && submitError && (
            <p className="step-error" role="alert">{submitError}</p>
          )}

          <div className="step-nav">

            {step > 0 && (
              <button type="button" className="step-nav__back" onClick={goBack}>
                <ArrowLeft aria-hidden="true" />
                Retour
              </button>
            )}

            {!isLastStep && step !== 2 && (
              <button type="button" className="step-nav__next" onClick={goNext}>
                Suivant
                <ArrowRight aria-hidden="true" />
              </button>
            )}

            {isLastStep && (
              <button
                type="button"
                className="step-nav__next"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 aria-hidden="true" />
                ) : (
                  <>
                    Envoyer
                    <Send aria-hidden="true" />
                  </>
                )}
              </button>
            )}

          </div>

        </div>

        <SummaryCard
          state={state}
          step={step}
          submitting={submitting}
          onProceedToProof={handleProceedToProof}
        />

      </div>

    </section>
  );
};

export default ContributionForm;
