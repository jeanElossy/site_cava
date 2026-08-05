import { RadioGroup, TextField } from "../shared/fields";
import { CONTACT_METHOD_OPTIONS } from "./options";

// §B (suite) — Moyen de contact préféré.
const StepContact = ({ data, onChange, disabled }) => (
  <div className="admin-form">
    <div className="admin-form__grid">
      <RadioGroup
        label="Moyen de contact préféré"
        name="preferredContactMethod"
        value={data.preferredContactMethod}
        onChange={(value) => onChange({ preferredContactMethod: value })}
        options={CONTACT_METHOD_OPTIONS}
        disabled={disabled}
      />
      <TextField
        label="Jours ou horaires favorables pour être contacté(e)"
        name="availableTimes"
        value={data.availableTimes}
        onChange={(value) => onChange({ availableTimes: value })}
        disabled={disabled}
        wide
      />
    </div>
  </div>
);

export default StepContact;
