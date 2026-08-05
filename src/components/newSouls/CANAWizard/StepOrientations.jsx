import { BooleanField, CheckboxGroup, DateField } from "../shared/fields";
import { ORIENTATIONS_OPTIONS } from "./options";
import PlanTable from "./PlanTable";

// §M — Orientations décidées par la CANA + plan coordonné
// d'accompagnement (tableau dynamique).
const StepOrientations = ({ data, onChange, disabled }) => (
  <div className="admin-form">
    <div className="admin-form__grid">
      <CheckboxGroup
        label="Orientations décidées par la CANA"
        name="orientations"
        values={data.orientations ?? []}
        onChange={(values) => onChange({ orientations: values })}
        options={ORIENTATIONS_OPTIONS}
        otherValue={data.orientationsOther}
        onOtherChange={(value) => onChange({ orientationsOther: value })}
        disabled={disabled}
      />
    </div>

    <fieldset className="admin-form__fieldset">
      <legend>Plan coordonné d'accompagnement</legend>
      <PlanTable
        rows={data.plan ?? []}
        onChange={(rows) => onChange({ plan: rows })}
        disabled={disabled}
      />

      <div className="admin-form__grid">
        <BooleanField
          label="Plan validé par la responsable de la CANA"
          name="planValidated"
          value={data.planValidated}
          onChange={(value) =>
            onChange({ planValidated: value, planValidatedAt: value ? new Date().toISOString() : null })
          }
          disabled={disabled}
        />
        <DateField
          label="Date de validation"
          name="planValidatedAt"
          value={data.planValidatedAt}
          onChange={(value) => onChange({ planValidatedAt: value })}
          disabled={disabled}
        />
        <BooleanField
          label="Orientations expliquées à la personne"
          name="orientationsExplained"
          value={data.orientationsExplained}
          onChange={(value) => onChange({ orientationsExplained: value })}
          disabled={disabled}
        />
        <BooleanField
          label="Accord de la personne"
          name="personAgreed"
          value={data.personAgreed}
          onChange={(value) => onChange({ personAgreed: value })}
          disabled={disabled}
        />
      </div>
    </fieldset>
  </div>
);

export default StepOrientations;
