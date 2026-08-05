import { RadioGroup, TextAreaField, TextField } from "../shared/fields";
import {
  UNDERSTANDS_SALVATION_OPTIONS,
  FREQUENCY_OPTIONS,
  READS_BIBLE_OPTIONS,
  RECEIVED_FOUNDATIONS_OPTIONS,
  SITUATION_CLARIFIED_OPTIONS,
} from "./options";

// §L.1 (Salut et vie chrétienne) + §L.2 (Parcours ecclésial).
const StepSpiritualDiagnosis = ({ data, onChange, disabled }) => (
  <div className="admin-form">
    <div className="admin-form__grid">
      <RadioGroup
        label="La personne comprend-elle le sens du salut ?"
        name="understandsSalvation"
        value={data.understandsSalvation}
        onChange={(value) => onChange({ understandsSalvation: value })}
        options={UNDERSTANDS_SALVATION_OPTIONS}
        disabled={disabled}
      />
      <RadioGroup
        label="Prie-t-elle personnellement ?"
        name="prays"
        value={data.prays}
        onChange={(value) => onChange({ prays: value })}
        options={FREQUENCY_OPTIONS}
        disabled={disabled}
      />
      <RadioGroup
        label="Lit-elle la Bible ?"
        name="readsBible"
        value={data.readsBible}
        onChange={(value) => onChange({ readsBible: value })}
        options={READS_BIBLE_OPTIONS}
        disabled={disabled}
      />
      <RadioGroup
        label="A-t-elle reçu des enseignements fondamentaux ?"
        name="receivedFoundations"
        value={data.receivedFoundations}
        onChange={(value) => onChange({ receivedFoundations: value })}
        options={RECEIVED_FOUNDATIONS_OPTIONS}
        disabled={disabled}
      />
      <TextAreaField
        label="Observations spirituelles"
        name="spiritualObservations"
        value={data.spiritualObservations}
        onChange={(value) => onChange({ spiritualObservations: value })}
        disabled={disabled}
      />
    </div>

    <fieldset className="admin-form__fieldset">
      <legend>Parcours ecclésial</legend>
      <div className="admin-form__grid">
        <TextField
          label="Église précédemment fréquentée"
          name="previousChurch"
          value={data.previousChurch}
          onChange={(value) => onChange({ previousChurch: value })}
          disabled={disabled}
        />
        <TextField
          label="Durée de fréquentation"
          name="previousChurchDuration"
          value={data.previousChurchDuration}
          onChange={(value) => onChange({ previousChurchDuration: value })}
          disabled={disabled}
        />
        <TextField
          label="Responsabilité éventuellement exercée"
          name="previousChurchResponsibility"
          value={data.previousChurchResponsibility}
          onChange={(value) => onChange({ previousChurchResponsibility: value })}
          disabled={disabled}
          wide
        />
        <TextAreaField
          label="Motif de son départ ou de son éloignement"
          name="departureReason"
          value={data.departureReason}
          onChange={(value) => onChange({ departureReason: value })}
          disabled={disabled}
        />
        <RadioGroup
          label="Sa situation avec son ancienne Église est-elle clarifiée ?"
          name="situationClarified"
          value={data.situationClarified}
          onChange={(value) => onChange({ situationClarified: value })}
          options={SITUATION_CLARIFIED_OPTIONS}
          disabled={disabled}
        />
      </div>
    </fieldset>
  </div>
);

export default StepSpiritualDiagnosis;
