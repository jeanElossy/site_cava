import { useId } from "react";

import { VIDEO_KINDS } from "./video";

import FileField from "../FileField";
import GalleryField from "../GalleryField";
import RepeaterField from "../RepeaterField";

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

          {descriptor.upload ? (
            <FileField
              id={valueId}
              value={value.value}
              onChange={(next) =>
                onChange({ kind: value.kind, value: next })
              }
              folder={descriptor.uploadFolder}
              accept={descriptor.uploadAccept ?? "media"}
            />
          ) : (
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
          )}
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

// `fieldError` : message de validation renvoyé par l'API POUR CE
// CHAMP (voir `errorDetails` plus bas). Il s'affiche sous le contrôle
// concerné, et pas seulement en tête de formulaire : l'administration
// recevait jusqu'ici un « Les données envoyées sont invalides » sans
// jamais savoir quel champ posait problème, alors que le serveur
// l'indiquait déjà dans sa réponse.
const Field = ({ field, value, onChange, fieldError }) => {
  const id = useId();
  const helpId = useId();
  const errorId = useId();

  const common = {
    id,
    name: field.name,
    required: field.required,
    "aria-invalid": fieldError ? true : undefined,
    "aria-describedby":
      [field.help ? helpId : null, fieldError ? errorId : null]
        .filter(Boolean)
        .join(" ") || undefined,
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

        {fieldError && (
          <p className="admin-form__field-error" id={errorId}>
            {fieldError}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={`admin-form__field${
        field.wide ? " admin-form__field--wide" : ""
      }${fieldError ? " admin-form__field--invalid" : ""}`}
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

      {field.type === "repeater" && (
        <RepeaterField
          value={value ?? []}
          onChange={(next) => onChange(field.name, next)}
          fields={field.fields}
          max={field.max}
          itemLabel={field.itemLabel}
          addLabel={field.addLabel}
          emptyText={field.emptyText}
          folder={field.folder}
        />
      )}

      {field.type === "gallery" && (
        <GalleryField
          value={value ?? []}
          onChange={(next) => onChange(field.name, next)}
          folder={field.folder}
          max={field.max ?? 30}
        />
      )}

      {field.type === "upload" && (
        <FileField
          id={id}
          value={value ?? ""}
          onChange={(next) => onChange(field.name, next)}
          folder={field.folder}
          accept={field.accept ?? "image"}
          previewShape={field.previewShape}
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

      {![
        "textarea",
        "select",
        "checkbox",
        "upload",
        "gallery",
        "repeater",
      ].includes(
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

      {fieldError && (
        <p className="admin-form__field-error" id={errorId}>
          {fieldError}
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
  // Détail champ par champ renvoyé par l'API en cas de 422
  // (`error.details` — voir backend/src/middlewares/error.js). Le
  // serveur l'envoyait déjà, mais rien ne l'affichait.
  errorDetails = null,
}) => {
  // Messages qui ne correspondent à aucun champ du formulaire (nom de
  // sous-document Mongoose, champ non éditable ici…) : ils seraient
  // perdus s'ils n'étaient affichés que sous leur champ.
  const knownFieldNames = new Set(fields.map((field) => field.name));

  const orphanErrors = Object.entries(errorDetails ?? {}).filter(
    ([name]) => !knownFieldNames.has(name)
  );

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
              fieldError={errorDetails?.[field.name]}
            />
          )
        )}
      </div>

      {error && (
        <div
          className="admin-form__error"
          role="alert"
        >
          <p>{error}</p>

          {orphanErrors.length > 0 && (
            <ul>
              {orphanErrors.map(([name, message]) => (
                <li key={name}>{message}</li>
              ))}
            </ul>
          )}
        </div>
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
