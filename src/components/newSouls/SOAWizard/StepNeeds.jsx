import { CheckboxGroup, TextAreaField } from "../shared/fields";
import { NEEDS_OPTIONS } from "./options";

// §E — Besoins et demandes exprimés.
const StepNeeds = ({ data, onChange, disabled }) => (
  <div className="admin-form">
    <div className="admin-form__grid">
      <CheckboxGroup
        label="Besoins et demandes exprimés"
        name="needs"
        values={data.needs ?? []}
        onChange={(values) => onChange({ needs: values })}
        options={NEEDS_OPTIONS}
        otherValue={data.needsOther}
        onOtherChange={(value) => onChange({ needsOther: value })}
        disabled={disabled}
      />
      <TextAreaField
        label="Précisions données par la personne"
        name="needsDetails"
        value={data.needsDetails}
        onChange={(value) => onChange({ needsDetails: value })}
        disabled={disabled}
      />
    </div>
  </div>
);

export default StepNeeds;
