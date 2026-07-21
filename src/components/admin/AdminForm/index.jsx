import { useId } from "react";

import { VIDEO_KINDS } from "./video";

import FileField from "../FileField";

import "./AdminForm.scss";

const VideoField = ({ value, onChange }) => {
  const kindId = useId();
  const valueId = useId();
  const helpId = useId();

  const descriptor =
    VIDEO_KINDS.find((item) => item.value === value.kind) ??
    VIDEO_KINDS[0];

  return (
    <fieldset className="admin-form__fieldset">
      <legend>Vidéo rattachée</legend>

      <div className="admin-form__field">
        <label htmlFor={kindId}>Type de vidéo</label>

        <select
          id={kindId}
          value={value.kind}
          onChange={(event) =>
            onChange({ kind: event.target.value, value: "" })
          }
        >
          {VIDEO_KINDS.map((item) => (
            <option
              key={item.value}
              value={item.value}
            >
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {descriptor.field && (
        <div className="admin-form__field">
          <label htmlFor={valueId}>{descriptor.fieldLabel}</label>

          <input
            id={valueId}
            type="text"
            value={value.value}
            placeholder={descriptor.placeholder}
            aria-describedby={helpId}
            onChange={(event) =>
              onChange({
                kind: value.kind,
                value: event.target.value,
              })
            }
          />
        </div>
      )}

      <p
        className="admin-form__help"
        id={helpId}
      >
        {descriptor.help}
      </p>
    </fieldset>
  );
};

const Field = ({ field, value, onChange }) => {
  const id = useId();
  const helpId = useId();

  const common = {
    id,
    name: field.name,
    required: field.required,
    "aria-describedby": field.help ? helpId : undefined,
    onChange: (event) =>
      onChange(
        field.name,
        field.type === "checkbox"
          ? event.target.checked
          : event.target.value
      ),
  };

  if (field.type === "checkbox") {
    return (
      <div className="admin-form__field admin-form__field--inline">
        <input
          {...common}
          type="checkbox"
          checked={Boolean(value)}
        />

        <label htmlFor={id}>{field.label}</label>

        {field.help && (
          <p
            className="admin-form__help"
            id={helpId}
          >
            {field.help}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={`admin-form__field${
        field.wide ? " admin-form__field--wide" : ""
      }`}
    >
      <label htmlFor={id}>
        {field.label}

        {field.required && (
          <span
            className="admin-form__required"
            aria-hidden="true"
          >
            {" *"}
          </span>
        )}
      </label>

      {field.type === "upload" && (
        <FileField
          id={id}
          value={value ?? ""}
          onChange={(next) => onChange(field.name, next)}
          folder={field.folder}
          accept={field.accept ?? "image"}
        />
      )}

      {field.type === "textarea" && (
        <textarea
          {...common}
          rows={field.rows ?? 4}
          placeholder={field.placeholder}
          value={value ?? ""}
        />
      )}

      {field.type === "select" && (
        <select
          {...common}
          value={value ?? ""}
        >
          <option value="">—</option>

          {field.options.map((option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>
      )}

      {!["textarea", "select", "checkbox", "upload"].includes(
        field.type
      ) && (
        <input
          {...common}
          type={field.type ?? "text"}
          placeholder={field.placeholder}
          value={value ?? ""}
        />
      )}

      {field.help && (
        <p
          className="admin-form__help"
          id={helpId}
        >
          {field.help}
        </p>
      )}
    </div>
  );
};

/**
 * Formulaire piloté par un schéma de champs. Chaque champ porte un
 * `<label>` réellement associé à son contrôle (pas de placeholder en
 * guise d'étiquette).
 */
const AdminForm = ({
  fields,
  values,
  onChange,
  onSubmit,
  onCancel,
  submitLabel = "Enregistrer",
  busy = false,
  error = null,
}) => {
  return (
    <form
      className="admin-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="admin-form__grid">
        {fields.map((field) =>
          field.type === "video" ? (
            <div
              key={field.name}
              className="admin-form__field--wide"
            >
              <VideoField
                value={values[field.name]}
                onChange={(next) => onChange(field.name, next)}
              />
            </div>
          ) : (
            <Field
              key={field.name}
              field={field}
              value={values[field.name]}
              onChange={onChange}
            />
          )
        )}
      </div>

      {error && (
        <p
          className="admin-form__error"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="admin-form__actions">
        {onCancel && (
          <button
            type="button"
            className="admin-form__button admin-form__button--ghost"
            onClick={onCancel}
            disabled={busy}
          >
            Annuler
          </button>
        )}

        <button
          type="submit"
          className="admin-form__button"
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? "Enregistrement…" : submitLabel}
        </button>
      </div>
    </form>
  );
};

export default AdminForm;
