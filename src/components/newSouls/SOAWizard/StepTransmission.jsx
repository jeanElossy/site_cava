import { useState } from "react";

import { RadioGroup, TextAreaField } from "../shared/fields";
import { COMPLETENESS_OPTIONS } from "./options";

// §G — Transmission du dossier à la CANA. Dernière étape : contient
// l'action qui verrouille définitivement la partie SOA.
const StepTransmission = ({ data, onChange, disabled, onTransmit }) => {
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleTransmit = async () => {
    setError(null);
    setSubmitting(true);

    try {
      await onTransmit();
    } catch (err) {
      setError(err.message ?? "La transmission a échoué.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-form">
      <div className="admin-form__grid">
        <RadioGroup
          label="État du dossier"
          name="completeness"
          value={data.completeness}
          onChange={(value) => onChange({ completeness: value })}
          options={COMPLETENESS_OPTIONS}
          disabled={disabled}
        />
        {data.completeness === "a_completer" && (
          <TextAreaField
            label="Informations manquantes"
            name="missingInfo"
            value={data.missingInfo}
            onChange={(value) => onChange({ missingInfo: value })}
            disabled={disabled}
          />
        )}
      </div>

      {error && <p className="admin-form__error">{error}</p>}

      {!disabled && (
        <div className="admin-form__actions">
          <button
            type="button"
            className="admin-form__button"
            disabled={submitting}
            onClick={handleTransmit}
          >
            {submitting ? "Transmission…" : "Transmettre à la CANA"}
          </button>
        </div>
      )}
    </div>
  );
};

export default StepTransmission;
