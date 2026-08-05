import { DateField, TextField } from "../shared/fields";

// §A — Identification du dossier. Le numéro de dossier et l'agent
// SOA sont déjà connus (générés/posés à la création) : affichés en
// lecture seule, jamais ressaisis.
const StepDossier = ({ data, onChange, disabled, caseNumber, agentName }) => (
  <div className="admin-form">
    <div className="admin-form__grid">
      <div className="admin-form__field">
        <label>Numéro du dossier</label>
        <input type="text" value={caseNumber ?? "—"} disabled />
      </div>

      <div className="admin-form__field">
        <label>Agent SOA</label>
        <input type="text" value={agentName ?? "—"} disabled />
      </div>

      <DateField
        label="Date d'ouverture"
        name="openedAt"
        value={data.openedAt}
        onChange={(value) => onChange({ openedAt: value })}
        disabled={disabled}
      />
      <DateField
        label="Date du premier passage à ÇA.VA."
        name="firstVisitAt"
        value={data.firstVisitAt}
        onChange={(value) => onChange({ firstVisitAt: value })}
        disabled={disabled}
      />
      <TextField
        label="Culte ou activité concerné(e)"
        name="service"
        value={data.service}
        onChange={(value) => onChange({ service: value })}
        disabled={disabled}
        wide
      />
    </div>
  </div>
);

export default StepDossier;
