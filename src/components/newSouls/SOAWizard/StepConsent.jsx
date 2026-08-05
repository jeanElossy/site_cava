import { DateField, RadioGroup, TextField } from "../shared/fields";
import { CONSENT_OPTIONS } from "./options";

// §F — Accord pour être contacté(e).
const StepConsent = ({ data, onChange, disabled, agentName }) => (
  <div className="admin-form">
    <div className="admin-form__grid">
      <RadioGroup
        label="La personne accepte-t-elle d'être contactée par la CANA ?"
        name="consent"
        value={data.consent}
        onChange={(value) => onChange({ consent: value })}
        options={CONSENT_OPTIONS}
        disabled={disabled}
      />

      <div className="admin-form__field admin-form__field--wide">
        <p className="admin-form__help">
          La personne a été informée que : ses coordonnées seront utilisées pour son
          accompagnement ; la CANA lui proposera un entretien ; ses informations seront traitées
          avec confidentialité.
        </p>
      </div>

      <DateField
        label="Date de l'accord"
        name="consentDate"
        value={data.consentDate}
        onChange={(value) => onChange({ consentDate: value })}
        disabled={disabled}
      />
      <TextField
        label="Nom du membre du SOA ayant recueilli l'accord"
        name="consentCollectedBy"
        value={data.consentCollectedBy ?? agentName}
        onChange={(value) => onChange({ consentCollectedBy: value })}
        disabled={disabled}
      />
    </div>
  </div>
);

export default StepConsent;
