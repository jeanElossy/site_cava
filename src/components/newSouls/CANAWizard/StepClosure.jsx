import { useState } from "react";

import {
  BooleanField,
  CheckboxGroup,
  DateField,
  RadioGroup,
  SelectField,
  TextAreaField,
  TextField,
} from "../shared/fields";
import { FINAL_SITUATION_OPTIONS, INTEGRATION_CONFIRMED_OPTIONS } from "./options";

// §P (bilan final) + §Q (orientation vers une bergerie) + §R
// (validation et clôture). Dernière étape du parcours CANA : contient
// l'action qui clôture le dossier et crée le Member correspondant.
const StepClosure = ({ data, onChange, disabled, flockOptions, canClose, onClose }) => {
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleClose = async () => {
    setError(null);
    setSubmitting(true);

    try {
      await onClose();
    } catch (err) {
      setError(err.message ?? "La clôture a échoué.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-form">
      <fieldset className="admin-form__fieldset">
        <legend>Évaluation de fin de parcours</legend>
        <div className="admin-form__grid">
          <DateField
            label="Date du bilan final"
            name="finalReviewDate"
            value={data.finalReviewDate}
            onChange={(value) => onChange({ finalReviewDate: value })}
            disabled={disabled}
          />
          <BooleanField
            label="Responsable de la CANA présente"
            name="finalReviewResponsablePresent"
            value={data.finalReviewResponsablePresent}
            onChange={(value) => onChange({ finalReviewResponsablePresent: value })}
            disabled={disabled}
          />
          <BooleanField
            label="Coordonnateur général des bergeries présent"
            name="finalReviewCoordinateurPresent"
            value={data.finalReviewCoordinateurPresent}
            onChange={(value) => onChange({ finalReviewCoordinateurPresent: value })}
            disabled={disabled}
          />
          <CheckboxGroup
            label="Situation à la fin des 4 mois"
            name="finalSituation"
            values={data.finalSituation ?? []}
            onChange={(values) => onChange({ finalSituation: values })}
            options={FINAL_SITUATION_OPTIONS}
            disabled={disabled}
          />
          <TextAreaField
            label="Synthèse du parcours"
            name="finalSummary"
            value={data.finalSummary}
            onChange={(value) => onChange({ finalSummary: value })}
            disabled={disabled}
          />
        </div>
      </fieldset>

      <fieldset className="admin-form__fieldset">
        <legend>Orientation vers une bergerie</legend>
        <div className="admin-form__grid">
          <SelectField
            label="Bergerie retenue"
            name="flock"
            value={data.flock}
            onChange={(value) => onChange({ flock: value })}
            options={flockOptions ?? []}
            disabled={disabled}
            required
          />
          <TextField
            label="Berger responsable"
            name="shepherd"
            value={data.shepherd}
            onChange={(value) => onChange({ shepherd: value })}
            disabled={disabled}
          />
          <TextAreaField
            label="Motif de l'orientation"
            name="flockReason"
            value={data.flockReason}
            onChange={(value) => onChange({ flockReason: value })}
            disabled={disabled}
          />
          <DateField
            label="Date de décision"
            name="flockDecisionDate"
            value={data.flockDecisionDate}
            onChange={(value) => onChange({ flockDecisionDate: value })}
            disabled={disabled}
          />
          <DateField
            label="Date de transmission au berger"
            name="flockTransmissionDate"
            value={data.flockTransmissionDate}
            onChange={(value) => onChange({ flockTransmissionDate: value })}
            disabled={disabled}
          />
          <DateField
            label="Date de mise en relation"
            name="flockContactDate"
            value={data.flockContactDate}
            onChange={(value) => onChange({ flockContactDate: value })}
            disabled={disabled}
          />
          <DateField
            label="Date de la première participation à la bergerie"
            name="flockFirstParticipationDate"
            value={data.flockFirstParticipationDate}
            onChange={(value) => onChange({ flockFirstParticipationDate: value })}
            disabled={disabled}
          />
          <RadioGroup
            label="Intégration confirmée"
            name="integrationConfirmed"
            value={data.integrationConfirmed}
            onChange={(value) => onChange({ integrationConfirmed: value })}
            options={INTEGRATION_CONFIRMED_OPTIONS}
            disabled={disabled}
          />
        </div>
      </fieldset>

      <fieldset className="admin-form__fieldset">
        <legend>Validation et clôture du dossier</legend>
        <div className="admin-form__grid">
          <TextAreaField
            label="Avis du coordonnateur général des bergeries"
            name="coordinateurOpinion"
            value={data.coordinateurOpinion}
            onChange={(value) => onChange({ coordinateurOpinion: value })}
            disabled={disabled}
          />
          <TextAreaField
            label="Avis de la responsable de la CANA"
            name="responsableOpinion"
            value={data.responsableOpinion}
            onChange={(value) => onChange({ responsableOpinion: value })}
            disabled={disabled}
          />
        </div>
      </fieldset>

      {error && <p className="admin-form__error">{error}</p>}

      {canClose && !disabled && (
        <div className="admin-form__actions">
          <button
            type="button"
            className="admin-form__button"
            disabled={submitting}
            onClick={handleClose}
          >
            {submitting ? "Clôture…" : "Clôturer le dossier et intégrer en bergerie"}
          </button>
        </div>
      )}
    </div>
  );
};

export default StepClosure;
