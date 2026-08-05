import { RadioGroup, TextAreaField, TextField } from "../shared/fields";
import { DECISION_OPTIONS, WATER_BAPTISM_OPTIONS, CURRENT_CHURCH_OPTIONS } from "./options";

// §D — Situation spirituelle déclarée.
const StepSpiritual = ({ data, onChange, disabled }) => (
  <div className="admin-form">
    <div className="admin-form__grid">
      <RadioGroup
        label="Décision pour Jésus-Christ — la personne déclare :"
        name="decision"
        value={data.decision}
        onChange={(value) => onChange({ decision: value })}
        options={DECISION_OPTIONS}
        otherValue={data.decisionOther}
        onOtherChange={(value) => onChange({ decisionOther: value })}
        disabled={disabled}
      />

      <RadioGroup
        label="A-t-elle déjà été baptisée d'eau ?"
        name="waterBaptism"
        value={data.waterBaptism}
        onChange={(value) => onChange({ waterBaptism: value })}
        options={WATER_BAPTISM_OPTIONS}
        disabled={disabled}
      />
      {data.waterBaptism === "oui" && (
        <TextField
          label="Année ou période approximative"
          name="waterBaptismYear"
          value={data.waterBaptismYear}
          onChange={(value) => onChange({ waterBaptismYear: value })}
          disabled={disabled}
        />
      )}

      <RadioGroup
        label="Fréquente-t-elle actuellement une autre Église ?"
        name="currentChurch"
        value={data.currentChurch}
        onChange={(value) => onChange({ currentChurch: value })}
        options={CURRENT_CHURCH_OPTIONS}
        disabled={disabled}
      />
      {data.currentChurch === "oui" && (
        <TextField
          label="Laquelle ?"
          name="currentChurchName"
          value={data.currentChurchName}
          onChange={(value) => onChange({ currentChurchName: value })}
          disabled={disabled}
        />
      )}

      <TextAreaField
        label="Observations du SOA"
        name="observations"
        value={data.observations}
        onChange={(value) => onChange({ observations: value })}
        disabled={disabled}
      />
    </div>
  </div>
);

export default StepSpiritual;
