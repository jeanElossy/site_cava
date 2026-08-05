import { RadioGroup, TextField } from "../shared/fields";
import { CATEGORY_OPTIONS } from "./options";

const GENDER_OPTIONS = [
  { value: "homme", label: "Homme" },
  { value: "femme", label: "Femme" },
];

// §B — Informations essentielles.
const StepPersonal = ({ data, onChange, disabled }) => (
  <div className="admin-form">
    <div className="admin-form__grid">
      <TextField
        label="Nom"
        name="lastName"
        value={data.lastName}
        onChange={(value) => onChange({ lastName: value })}
        disabled={disabled}
        required
      />
      <TextField
        label="Prénoms"
        name="firstName"
        value={data.firstName}
        onChange={(value) => onChange({ firstName: value })}
        disabled={disabled}
        required
      />

      <RadioGroup
        label="Sexe"
        name="gender"
        value={data.gender}
        onChange={(value) => onChange({ gender: value })}
        options={GENDER_OPTIONS}
        disabled={disabled}
        wide={false}
      />
      <RadioGroup
        label="Catégorie"
        name="category"
        value={data.category}
        onChange={(value) => onChange({ category: value })}
        options={CATEGORY_OPTIONS}
        disabled={disabled}
        wide={false}
      />

      <TextField
        label="Numéro de téléphone"
        name="phone"
        type="tel"
        value={data.phone}
        onChange={(value) => onChange({ phone: value })}
        disabled={disabled}
        required
      />
      <TextField
        label="Numéro WhatsApp, si différent"
        name="whatsapp"
        type="tel"
        value={data.whatsapp}
        onChange={(value) => onChange({ whatsapp: value })}
        disabled={disabled}
      />

      <TextField
        label="Quartier ou lieu d'habitation"
        name="area"
        value={data.area}
        onChange={(value) => onChange({ area: value })}
        disabled={disabled}
      />
      <TextField
        label="Repère géographique"
        name="landmark"
        value={data.landmark}
        onChange={(value) => onChange({ landmark: value })}
        disabled={disabled}
      />
    </div>
  </div>
);

export default StepPersonal;
