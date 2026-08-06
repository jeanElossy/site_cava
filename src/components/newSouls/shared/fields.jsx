// Primitives de champ partagées par SOAWizard et CANAWizard.
//
// Réutilisent volontairement les classes `.admin-form__*` déjà
// stylées (voir src/components/admin/AdminForm/AdminForm.scss) : tout
// champ ici doit être rendu à l'intérieur d'un conteneur portant la
// classe `admin-form` pour hériter de ce style, sans dupliquer une
// seule règle CSS.
//
// L'import direct ci-dessous (plutôt que de compter sur le fait que
// `<AdminForm>` charge déjà ces styles ailleurs) est nécessaire car
// Vite découpe le JS par route (`/admin` et `/presence` sont deux
// morceaux de bundle séparés, voir AdminLayout.jsx et
// PresenceScanner.jsx) : les deux wizards sont aussi ouverts depuis
// VisitorsPanel, sur la route `/presence`, qui ne charge jamais le
// composant `<AdminForm>` autrement. Sans cet import, les champs y
// perdent tout style (bordure, fond, espacement) — repéré via des
// captures d'écran montrant les libellés et valeurs collés les uns
// aux autres.
import { OUI_NON } from "./constants";

import "../../admin/AdminForm/AdminForm.scss";
import "./NewSouls.scss";

const optionId = (name, value) => `${name}-${value}`;

export const TextField = ({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
  wide,
  disabled,
  required,
}) => (
  <div className={`admin-form__field${wide ? " admin-form__field--wide" : ""}`}>
    <label htmlFor={name}>
      {label}
      {required && <span className="admin-form__required"> *</span>}
    </label>
    <input
      id={name}
      name={name}
      type={type}
      value={value ?? ""}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  </div>
);

export const DateField = ({ label, name, value, onChange, wide, disabled }) => {
  const isoDate = value ? String(value).slice(0, 10) : "";

  return (
    <div className={`admin-form__field${wide ? " admin-form__field--wide" : ""}`}>
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type="date"
        value={isoDate}
        disabled={disabled}
        onChange={(event) =>
          onChange(event.target.value ? new Date(event.target.value).toISOString() : null)
        }
      />
    </div>
  );
};

export const TextAreaField = ({ label, name, value, onChange, wide = true, rows = 3, disabled }) => (
  <div className={`admin-form__field${wide ? " admin-form__field--wide" : ""}`}>
    <label htmlFor={name}>{label}</label>
    <textarea
      id={name}
      name={name}
      rows={rows}
      value={value ?? ""}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  </div>
);

export const SelectField = ({ label, name, value, onChange, options, wide, disabled, placeholder = "—" }) => (
  <div className={`admin-form__field${wide ? " admin-form__field--wide" : ""}`}>
    <label htmlFor={name}>{label}</label>
    <select
      id={name}
      name={name}
      value={value ?? ""}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value || null)}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

// Groupe de boutons radio (choix unique). Si l'option choisie a
// `hasOther: true` (ex. "autre"), un champ texte complémentaire
// apparaît, piloté par `otherValue`/`onOtherChange`.
export const RadioGroup = ({
  label,
  name,
  value,
  onChange,
  options,
  wide = true,
  otherValue,
  onOtherChange,
  disabled,
}) => {
  const selected = options.find((option) => option.value === value);

  return (
    <div className={`admin-form__field${wide ? " admin-form__field--wide" : ""}`}>
      <label>{label}</label>
      <div className="new-soul-options">
        {options.map((option) => (
          <div className="admin-form__field admin-form__field--inline" key={option.value}>
            <input
              type="radio"
              id={optionId(name, option.value)}
              name={name}
              checked={value === option.value}
              disabled={disabled}
              onChange={() => onChange(option.value)}
            />
            <label htmlFor={optionId(name, option.value)}>{option.label}</label>
          </div>
        ))}
      </div>
      {selected?.hasOther && (
        <input
          type="text"
          placeholder="Précisez…"
          value={otherValue ?? ""}
          disabled={disabled}
          onChange={(event) => onOtherChange?.(event.target.value)}
        />
      )}
    </div>
  );
};

// Groupe de cases à cocher (choix multiple), `values` étant un
// tableau des valeurs actuellement cochées.
export const CheckboxGroup = ({
  label,
  name,
  values = [],
  onChange,
  options,
  wide = true,
  otherValue,
  onOtherChange,
  disabled,
}) => {
  const toggle = (optionValue) => {
    if (values.includes(optionValue)) {
      onChange(values.filter((item) => item !== optionValue));
    } else {
      onChange([...values, optionValue]);
    }
  };

  const hasOtherSelected = options.some((option) => option.hasOther && values.includes(option.value));

  return (
    <div className={`admin-form__field${wide ? " admin-form__field--wide" : ""}`}>
      <label>{label}</label>
      <div className="new-soul-options">
        {options.map((option) => (
          <div className="admin-form__field admin-form__field--inline" key={option.value}>
            <input
              type="checkbox"
              id={optionId(name, option.value)}
              checked={values.includes(option.value)}
              disabled={disabled}
              onChange={() => toggle(option.value)}
            />
            <label htmlFor={optionId(name, option.value)}>{option.label}</label>
          </div>
        ))}
      </div>
      {hasOtherSelected && (
        <input
          type="text"
          placeholder="Précisez…"
          value={otherValue ?? ""}
          disabled={disabled}
          onChange={(event) => onOtherChange?.(event.target.value)}
        />
      )}
    </div>
  );
};

export const BooleanField = ({ label, name, value, onChange, wide, disabled }) => (
  <RadioGroup
    label={label}
    name={name}
    value={value === true ? "oui" : value === false ? "non" : null}
    onChange={(next) => onChange(next === "oui")}
    options={OUI_NON}
    wide={wide}
    disabled={disabled}
  />
);
