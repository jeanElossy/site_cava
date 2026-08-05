import { BooleanField, DateField, RadioGroup, TextField } from "../shared/fields";
import { INTERVIEW_MODE_OPTIONS } from "./options";

// §J — Programmation de l'entretien initial.
const StepInterview = ({ data, onChange, disabled }) => (
  <div className="admin-form">
    <div className="admin-form__grid">
      <DateField
        label="Date de l'entretien"
        name="interviewDate"
        value={data.interviewDate}
        onChange={(value) => onChange({ interviewDate: value })}
        disabled={disabled}
      />

      <BooleanField
        label="Responsable de la CANA présente"
        name="interviewResponsablePresent"
        value={data.interviewResponsablePresent}
        onChange={(value) => onChange({ interviewResponsablePresent: value })}
        disabled={disabled}
      />
      <BooleanField
        label="Coordonnateur général des bergeries présent"
        name="interviewCoordinateurPresent"
        value={data.interviewCoordinateurPresent}
        onChange={(value) => onChange({ interviewCoordinateurPresent: value })}
        disabled={disabled}
      />

      <RadioGroup
        label="Modalité de l'entretien"
        name="interviewMode"
        value={data.interviewMode}
        onChange={(value) => onChange({ interviewMode: value })}
        options={INTERVIEW_MODE_OPTIONS}
        otherValue={data.interviewModeOther}
        onOtherChange={(value) => onChange({ interviewModeOther: value })}
        disabled={disabled}
      />
      <TextField
        label="Lieu précis ou informations utiles"
        name="interviewLocation"
        value={data.interviewLocation}
        onChange={(value) => onChange({ interviewLocation: value })}
        disabled={disabled}
        wide
      />

      <BooleanField
        label="Entretien réalisé à la date prévue"
        name="interviewDone"
        value={data.interviewDone}
        onChange={(value) => onChange({ interviewDone: value })}
        disabled={disabled}
      />
      {data.interviewDone === false && (
        <DateField
          label="Nouvelle date"
          name="interviewRescheduledDate"
          value={data.interviewRescheduledDate}
          onChange={(value) => onChange({ interviewRescheduledDate: value })}
          disabled={disabled}
        />
      )}
    </div>
  </div>
);

export default StepInterview;
