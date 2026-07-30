import { churchLabel, GENDERS, MARITAL_STATUSES } from "./data";

const labelFor = (list, value) =>
  list.find((item) => item.value === value)?.label ?? "—";

const StepSummary = ({ state }) => (
  <div className="step-panel">
    <div className="summary-block">
      <h3>Votre demande</h3>

      <dl className="summary-list">
        <div>
          <dt>Type</dt>
          <dd>
            {state.kind === "new"
              ? "Nouvelle inscription"
              : `Mise à jour du matricule ${state.submittedRegistrationNumber}`}
          </dd>
        </div>

        <div>
          <dt>Nom complet</dt>
          <dd>
            {state.data.firstName} {state.data.lastName}
          </dd>
        </div>

        <div>
          <dt>Église</dt>
          <dd>{churchLabel(state.data.church)}</dd>
        </div>

        <div>
          <dt>Téléphone</dt>
          <dd>{state.data.phone || "—"}</dd>
        </div>

        <div>
          <dt>Genre</dt>
          <dd>{labelFor(GENDERS, state.data.gender)}</dd>
        </div>

        <div>
          <dt>Situation matrimoniale</dt>
          <dd>{labelFor(MARITAL_STATUSES, state.data.maritalStatus)}</dd>
        </div>

        <div>
          <dt>Profession</dt>
          <dd>{state.data.profession || "—"}</dd>
        </div>
      </dl>

      <p className="summary-note">
        Vérifiez vos informations avant l&apos;envoi. Vous pouvez
        revenir en arrière tant que vous n&apos;avez pas cliqué sur
        « Envoyer ma demande ».
      </p>
    </div>
  </div>
);

export default StepSummary;
