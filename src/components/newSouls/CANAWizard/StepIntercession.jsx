import { CheckboxGroup, RadioGroup, TextAreaField, TextField } from "../shared/fields";
import {
  PRAYER_TRANSMISSION_OPTIONS,
  PRAYER_CONFIDENTIALITY_OPTIONS,
  PRAYER_FOLLOW_UP_OPTIONS,
  DELIVERANCE_NEEDED_OPTIONS,
  DELIVERANCE_ACCEPTED_OPTIONS,
  PASTORAL_MEETING_NEEDED_OPTIONS,
  PASTORAL_MEETING_REASON_OPTIONS,
  PASTORAL_MEETING_PRIORITY_OPTIONS,
} from "./options";

// §L.3 (intercession) + §L.4 (délivrance) + §L.5 (rencontre
// pastorale). `showConfidential` (false pour le coordonnateur des
// bergeries) masque le compte rendu confidentiel de délivrance côté
// UI — la vraie protection est déjà côté serveur (champ jamais
// renvoyé), ceci évite seulement d'afficher un champ vide/interdit.
const StepIntercession = ({ data, onChange, disabled, showConfidential }) => (
  <div className="admin-form">
    <fieldset className="admin-form__fieldset">
      <legend>Besoins d'intercession</legend>
      <div className="admin-form__grid">
        <TextAreaField
          label="Sujet principal de prière"
          name="prayerMainSubject"
          value={data.prayerMainSubject}
          onChange={(value) => onChange({ prayerMainSubject: value })}
          disabled={disabled}
        />
        <TextAreaField
          label="Autres sujets"
          name="prayerOtherSubjects"
          value={data.prayerOtherSubjects}
          onChange={(value) => onChange({ prayerOtherSubjects: value })}
          disabled={disabled}
        />
        <RadioGroup
          label="Autorise-t-elle la transmission de son sujet au ministère d'intercession ?"
          name="prayerTransmissionAllowed"
          value={data.prayerTransmissionAllowed}
          onChange={(value) => onChange({ prayerTransmissionAllowed: value })}
          options={PRAYER_TRANSMISSION_OPTIONS}
          disabled={disabled}
        />
        <RadioGroup
          label="Niveau de confidentialité"
          name="prayerConfidentiality"
          value={data.prayerConfidentiality}
          onChange={(value) => onChange({ prayerConfidentiality: value })}
          options={PRAYER_CONFIDENTIALITY_OPTIONS}
          disabled={disabled}
        />
        <RadioGroup
          label="Type de suivi souhaité"
          name="prayerFollowUpType"
          value={data.prayerFollowUpType}
          onChange={(value) => onChange({ prayerFollowUpType: value })}
          options={PRAYER_FOLLOW_UP_OPTIONS}
          disabled={disabled}
        />
      </div>
    </fieldset>

    <fieldset className="admin-form__fieldset">
      <legend>Besoin d'accompagnement spirituel spécialisé</legend>
      <div className="admin-form__grid">
        <RadioGroup
          label="Une intervention du ministère de délivrance paraît-elle nécessaire ?"
          name="deliveranceNeeded"
          value={data.deliveranceNeeded}
          onChange={(value) => onChange({ deliveranceNeeded: value })}
          options={DELIVERANCE_NEEDED_OPTIONS}
          disabled={disabled}
        />
        <RadioGroup
          label="La personne accepte-t-elle cette orientation ?"
          name="deliveranceAccepted"
          value={data.deliveranceAccepted}
          onChange={(value) => onChange({ deliveranceAccepted: value })}
          options={DELIVERANCE_ACCEPTED_OPTIONS}
          disabled={disabled}
        />
        <TextField
          label="Motif général de l'orientation"
          name="deliveranceReason"
          value={data.deliveranceReason}
          onChange={(value) => onChange({ deliveranceReason: value })}
          disabled={disabled}
          wide
        />
        {showConfidential && (
          <TextAreaField
            label="Compte rendu confidentiel (réservé aux responsables autorisés)"
            name="deliveranceConfidentialNotes"
            value={data.deliveranceConfidentialNotes}
            onChange={(value) => onChange({ deliveranceConfidentialNotes: value })}
            disabled={disabled}
          />
        )}
      </div>
    </fieldset>

    <fieldset className="admin-form__fieldset">
      <legend>Besoin de rencontre pastorale</legend>
      <div className="admin-form__grid">
        <RadioGroup
          label="Une rencontre avec le pasteur est-elle recommandée ?"
          name="pastoralMeetingNeeded"
          value={data.pastoralMeetingNeeded}
          onChange={(value) => onChange({ pastoralMeetingNeeded: value })}
          options={PASTORAL_MEETING_NEEDED_OPTIONS}
          disabled={disabled}
        />
        <CheckboxGroup
          label="Motif général"
          name="pastoralMeetingReason"
          values={data.pastoralMeetingReason ?? []}
          onChange={(values) => onChange({ pastoralMeetingReason: values })}
          options={PASTORAL_MEETING_REASON_OPTIONS}
          disabled={disabled}
        />
        <RadioGroup
          label="Priorité"
          name="pastoralMeetingPriority"
          value={data.pastoralMeetingPriority}
          onChange={(value) => onChange({ pastoralMeetingPriority: value })}
          options={PASTORAL_MEETING_PRIORITY_OPTIONS}
          disabled={disabled}
        />
      </div>
    </fieldset>
  </div>
);

export default StepIntercession;
