import { CheckboxGroup, DateField, SelectField, TextAreaField } from "../shared/fields";
import { REVIEW_OPTIONS } from "./options";

// §H — Ouverture administrative du parcours. `receivedAt`/`responsable`
// sont déjà préremplis par l'accusé de réception automatique (voir
// newSoul.service.js#acknowledge) — affichés en lecture seule ici,
// jamais ressaisis.
const StepOpening = ({
  data,
  onChange,
  disabled,
  responsableName,
  formatDate,
  coordinateurOptions,
}) => (
  <div className="admin-form">
    <div className="admin-form__grid">
      <div className="admin-form__field">
        <label>Date de réception du dossier</label>
        <input type="text" value={formatDate(data.receivedAt)} disabled />
      </div>
      <div className="admin-form__field">
        <label>Responsable de la CANA</label>
        <input type="text" value={responsableName ?? "—"} disabled />
      </div>

      <DateField
        label="Date d'ouverture du parcours"
        name="openedAt"
        value={data.openedAt}
        onChange={(value) => onChange({ openedAt: value })}
        disabled={disabled}
      />
      <DateField
        label="Date prévisionnelle de fin des 4 mois"
        name="expectedEndAt"
        value={data.expectedEndAt}
        onChange={(value) => onChange({ expectedEndAt: value })}
        disabled={disabled}
      />

      <SelectField
        label="Coordonnateur général des bergeries"
        name="coordinateurBergeries"
        value={data.coordinateurBergeries}
        onChange={(value) => onChange({ coordinateurBergeries: value })}
        options={coordinateurOptions ?? []}
        disabled={disabled}
        wide
      />

      <CheckboxGroup
        label="Vérification du dossier"
        name="review"
        values={data.review ?? []}
        onChange={(values) => onChange({ review: values })}
        options={REVIEW_OPTIONS}
        disabled={disabled}
      />
      <TextAreaField
        label="Observations"
        name="reviewObservations"
        value={data.reviewObservations}
        onChange={(value) => onChange({ reviewObservations: value })}
        disabled={disabled}
      />
    </div>
  </div>
);

export default StepOpening;
