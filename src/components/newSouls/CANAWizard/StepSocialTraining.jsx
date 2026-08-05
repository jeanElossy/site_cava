import { BooleanField, CheckboxGroup, RadioGroup, TextAreaField, TextField } from "../shared/fields";
import {
  SOCIAL_NEED_OPTIONS,
  SOCIAL_NEED_AREAS_OPTIONS,
  TRAINING_NEEDED_OPTIONS,
  TRAINING_DIFFICULTY_OPTIONS,
  HAS_TRANSPORT_OPTIONS,
  FACES_OBSTACLES_OPTIONS,
  VISIT_POSSIBLE_OPTIONS,
} from "./options";

// §L.6 (situation sociale) + §L.7 (formation IFIP.VIE) + §L.8
// (situation relationnelle et disponibilité).
const StepSocialTraining = ({ data, onChange, disabled }) => (
  <div className="admin-form">
    <fieldset className="admin-form__fieldset">
      <legend>Situation sociale</legend>
      <div className="admin-form__grid">
        <RadioGroup
          label="La personne exprime-t-elle un besoin social ?"
          name="socialNeed"
          value={data.socialNeed}
          onChange={(value) => onChange({ socialNeed: value })}
          options={SOCIAL_NEED_OPTIONS}
          disabled={disabled}
        />
        <CheckboxGroup
          label="Domaine concerné"
          name="socialNeedAreas"
          values={data.socialNeedAreas ?? []}
          onChange={(values) => onChange({ socialNeedAreas: values })}
          options={SOCIAL_NEED_AREAS_OPTIONS}
          disabled={disabled}
        />
        <BooleanField
          label="Orientation vers la Commission sociale recommandée"
          name="socialCommissionReferral"
          value={data.socialCommissionReferral}
          onChange={(value) => onChange({ socialCommissionReferral: value })}
          disabled={disabled}
        />
        <TextAreaField
          label="Observation générale"
          name="socialObservations"
          value={data.socialObservations}
          onChange={(value) => onChange({ socialObservations: value })}
          disabled={disabled}
        />
      </div>
    </fieldset>

    <fieldset className="admin-form__fieldset">
      <legend>Besoin de formation — IFIP. VIE</legend>
      <div className="admin-form__grid">
        <RadioGroup
          label="La personne a-t-elle besoin d'un parcours de fondements ?"
          name="trainingNeeded"
          value={data.trainingNeeded}
          onChange={(value) => onChange({ trainingNeeded: value })}
          options={TRAINING_NEEDED_OPTIONS}
          disabled={disabled}
        />
        <TextField
          label="Formation recommandée"
          name="trainingRecommended"
          value={data.trainingRecommended}
          onChange={(value) => onChange({ trainingRecommended: value })}
          disabled={disabled}
        />
        <TextField
          label="Disponibilités"
          name="trainingAvailability"
          value={data.trainingAvailability}
          onChange={(value) => onChange({ trainingAvailability: value })}
          disabled={disabled}
        />
        <RadioGroup
          label="Difficulté particulière de lecture ou de compréhension"
          name="trainingDifficulty"
          value={data.trainingDifficulty}
          onChange={(value) => onChange({ trainingDifficulty: value })}
          options={TRAINING_DIFFICULTY_OPTIONS}
          disabled={disabled}
        />
      </div>
    </fieldset>

    <fieldset className="admin-form__fieldset">
      <legend>Situation relationnelle et disponibilité</legend>
      <div className="admin-form__grid">
        <BooleanField
          label="Connaît-elle déjà des membres de ÇA.VA. ?"
          name="knowsMembers"
          value={data.knowsMembers}
          onChange={(value) => onChange({ knowsMembers: value })}
          disabled={disabled}
        />
        {data.knowsMembers && (
          <TextField
            label="Si oui, lesquels ?"
            name="knownMembersNames"
            value={data.knownMembersNames}
            onChange={(value) => onChange({ knownMembersNames: value })}
            disabled={disabled}
            wide
          />
        )}
        <RadioGroup
          label="Dispose-t-elle d'un moyen de déplacement ?"
          name="hasTransport"
          value={data.hasTransport}
          onChange={(value) => onChange({ hasTransport: value })}
          options={HAS_TRANSPORT_OPTIONS}
          disabled={disabled}
        />
        <RadioGroup
          label="Rencontre-t-elle des obstacles pour participer aux activités ?"
          name="facesObstacles"
          value={data.facesObstacles}
          onChange={(value) => onChange({ facesObstacles: value })}
          options={FACES_OBSTACLES_OPTIONS}
          disabled={disabled}
        />
        <TextAreaField
          label="Contraintes signalées"
          name="obstaclesDetails"
          value={data.obstaclesDetails}
          onChange={(value) => onChange({ obstaclesDetails: value })}
          disabled={disabled}
        />
        <RadioGroup
          label="Possibilité d'une visite"
          name="visitPossible"
          value={data.visitPossible}
          onChange={(value) => onChange({ visitPossible: value })}
          options={VISIT_POSSIBLE_OPTIONS}
          disabled={disabled}
        />
      </div>
    </fieldset>
  </div>
);

export default StepSocialTraining;
