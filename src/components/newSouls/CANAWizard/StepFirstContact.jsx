import { DateField, RadioGroup, TextAreaField, TextField } from "../shared/fields";
import { CONTACT_METHOD_OPTIONS, FIRST_CONTACT_RESULT_OPTIONS } from "./options";

// §I — Premier contact effectué par la CANA. `firstContactDeadline`
// (réception + 48h) est calculé côté serveur à l'accusé de réception,
// affiché ici en lecture seule comme rappel de l'échéance.
const StepFirstContact = ({ data, onChange, disabled, formatDate }) => (
  <div className="admin-form">
    <div className="admin-form__grid">
      <div className="admin-form__field">
        <label>Date limite du premier contact (48h)</label>
        <input type="text" value={formatDate(data.firstContactDeadline)} disabled />
      </div>

      <DateField
        label="Date de la première tentative"
        name="firstContactAttemptAt"
        value={data.firstContactAttemptAt}
        onChange={(value) => onChange({ firstContactAttemptAt: value })}
        disabled={disabled}
      />

      <RadioGroup
        label="Moyen utilisé"
        name="firstContactMethod"
        value={data.firstContactMethod}
        onChange={(value) => onChange({ firstContactMethod: value })}
        options={CONTACT_METHOD_OPTIONS}
        disabled={disabled}
      />

      <RadioGroup
        label="Résultat"
        name="firstContactResult"
        value={data.firstContactResult}
        onChange={(value) => onChange({ firstContactResult: value })}
        options={FIRST_CONTACT_RESULT_OPTIONS}
        disabled={disabled}
      />

      <TextAreaField
        label="Compte rendu succinct"
        name="firstContactSummary"
        value={data.firstContactSummary}
        onChange={(value) => onChange({ firstContactSummary: value })}
        disabled={disabled}
      />

      <TextField
        label="Prochaine action"
        name="firstContactNextAction"
        value={data.firstContactNextAction}
        onChange={(value) => onChange({ firstContactNextAction: value })}
        disabled={disabled}
        wide
      />
      <DateField
        label="Date prévue"
        name="firstContactNextActionDate"
        value={data.firstContactNextActionDate}
        onChange={(value) => onChange({ firstContactNextActionDate: value })}
        disabled={disabled}
      />
    </div>
  </div>
);

export default StepFirstContact;
