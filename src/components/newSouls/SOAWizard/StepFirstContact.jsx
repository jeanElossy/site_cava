import { RadioGroup, TextField } from "../shared/fields";
import { ORIGIN_OPTIONS, FIRST_VISIT_OPTIONS } from "./options";

// §C — Circonstances du premier contact.
const StepFirstContact = ({ data, onChange, disabled }) => (
  <div className="admin-form">
    <div className="admin-form__grid">
      <RadioGroup
        label="Comment la personne est-elle arrivée à ÇA.VA. ?"
        name="origin"
        value={data.origin}
        onChange={(value) => onChange({ origin: value })}
        options={ORIGIN_OPTIONS}
        otherValue={data.originOther}
        onOtherChange={(value) => onChange({ originOther: value })}
        disabled={disabled}
      />
      <TextField
        label="Nom de la personne qui l'a invitée ou orientée"
        name="invitedBy"
        value={data.invitedBy}
        onChange={(value) => onChange({ invitedBy: value })}
        disabled={disabled}
        wide
      />
      <RadioGroup
        label="S'agit-il de sa première participation à ÇA.VA. ?"
        name="firstVisit"
        value={data.firstVisit}
        onChange={(value) => onChange({ firstVisit: value })}
        options={FIRST_VISIT_OPTIONS}
        disabled={disabled}
      />
      {data.firstVisit === "non" && (
        <TextField
          label="Depuis quand fréquente-t-elle l'Église ?"
          name="attendingSince"
          value={data.attendingSince}
          onChange={(value) => onChange({ attendingSince: value })}
          disabled={disabled}
          wide
        />
      )}
    </div>
  </div>
);

export default StepFirstContact;
