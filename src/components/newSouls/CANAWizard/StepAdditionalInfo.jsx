import { DateField, RadioGroup, TextField } from "../shared/fields";
import { MARITAL_STATUS_OPTIONS, CURRENT_SITUATION_OPTIONS } from "./options";

// §K — Informations personnelles complémentaires.
const StepAdditionalInfo = ({ data, onChange, disabled }) => (
  <div className="admin-form">
    <div className="admin-form__grid">
      <DateField
        label="Date ou année de naissance"
        name="dateOfBirth"
        value={data.dateOfBirth}
        onChange={(value) => onChange({ dateOfBirth: value })}
        disabled={disabled}
      />

      <RadioGroup
        label="Situation matrimoniale"
        name="maritalStatus"
        value={data.maritalStatus}
        onChange={(value) => onChange({ maritalStatus: value })}
        options={MARITAL_STATUS_OPTIONS}
        otherValue={data.maritalStatusOther}
        onOtherChange={(value) => onChange({ maritalStatusOther: value })}
        disabled={disabled}
      />

      <TextField
        label="Profession ou activité"
        name="profession"
        value={data.profession}
        onChange={(value) => onChange({ profession: value })}
        disabled={disabled}
      />
      <TextField
        label="Lieu de travail ou d'études, si utile"
        name="workplace"
        value={data.workplace}
        onChange={(value) => onChange({ workplace: value })}
        disabled={disabled}
      />
      <TextField
        label="Disponibilités habituelles"
        name="availability"
        value={data.availability}
        onChange={(value) => onChange({ availability: value })}
        disabled={disabled}
        wide
      />

      <RadioGroup
        label="Situation actuelle"
        name="currentSituation"
        value={data.currentSituation}
        onChange={(value) => onChange({ currentSituation: value })}
        options={CURRENT_SITUATION_OPTIONS}
        otherValue={data.currentSituationOther}
        onOtherChange={(value) => onChange({ currentSituationOther: value })}
        disabled={disabled}
      />
    </div>
  </div>
);

export default StepAdditionalInfo;
