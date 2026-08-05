import { CheckboxGroup } from "../shared/fields";
import { CHECKPOINTS_OPTIONS } from "./options";
import MonthlyFollowUp from "./MonthlyFollowUp";

// §O — Tableau des bilans mensuels + points à vérifier.
const StepMonthlyFollowUp = ({ data, onChange, disabled }) => (
  <div className="admin-form">
    <MonthlyFollowUp
      rows={data.monthlyFollowUps ?? []}
      onChange={(rows) => onChange({ monthlyFollowUps: rows })}
      disabled={disabled}
    />

    <div className="admin-form__grid">
      <CheckboxGroup
        label="Points à vérifier"
        name="checkpoints"
        values={data.checkpoints ?? []}
        onChange={(values) => onChange({ checkpoints: values })}
        options={CHECKPOINTS_OPTIONS}
        disabled={disabled}
      />
    </div>
  </div>
);

export default StepMonthlyFollowUp;
