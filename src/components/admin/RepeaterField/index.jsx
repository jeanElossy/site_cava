import { useId } from "react";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

import FileField from "../FileField";

import "./RepeaterField.scss";

// Champ répétable : une liste d'objets homogènes.
//
// Sert aux statistiques, aux responsables et aux témoignages d'un
// ministère — trois listes qui n'étaient modifiables qu'en base.
//
// Piloté par un schéma, comme AdminForm lui-même : décrire les
// sous-champs suffit, aucun composant spécifique à écrire par liste.
//
// La valeur est un TABLEAU D'OBJETS, exactement ce qu'attendent les
// sous-schémas Mongoose. Rien à traduire à l'enregistrement.

const emptyItem = (fields) =>
  fields.reduce((accumulator, field) => {
    accumulator[field.name] =
      field.type === "number" ? field.default ?? 1 : "";

    return accumulator;
  }, {});

const RepeaterField = ({
  value = [],
  onChange,
  fields = [],
  max = 20,
  itemLabel = "Élément",
  addLabel = "Ajouter",
  emptyText,
  folder,
}) => {
  const baseId = useId();

  const items = Array.isArray(value) ? value : [];

  const patch = (index, name, next) =>
    onChange(
      items.map((item, i) =>
        i === index ? { ...item, [name]: next } : item
      )
    );

  const add = () => {
    if (items.length >= max) return;

    onChange([...items, emptyItem(fields)]);
  };

  const removeAt = (index) =>
    onChange(items.filter((_unused, i) => i !== index));

  const move = (from, to) => {
    if (to < 0 || to >= items.length) return;

    const next = [...items];

    const [moved] = next.splice(from, 1);

    next.splice(to, 0, moved);

    onChange(next);
  };

  return (
    <div className="admin-repeater">
      {items.length === 0 && (
        <p className="admin-repeater__empty">
          {emptyText ??
            `Aucun élément. Utilisez « ${addLabel} » pour commencer.`}
        </p>
      )}

      {items.map((item, index) => (
        <article
          // L'index sert d'identifiant : ces éléments n'ont pas de clé
          // stable, et le réordonnancement passe par `onChange` qui
          // reconstruit la liste entière.
          key={`${baseId}-${index}`}
          className="admin-repeater__item"
        >
          <header className="admin-repeater__item-head">
            <span className="admin-repeater__item-title">
              {itemLabel} {index + 1}
            </span>

            <div className="admin-repeater__item-tools">
              <button
                type="button"
                onClick={() => move(index, index - 1)}
                disabled={index === 0}
                aria-label={`Monter ${itemLabel.toLowerCase()} ${index + 1}`}
              >
                <ChevronUp aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => move(index, index + 1)}
                disabled={index === items.length - 1}
                aria-label={`Descendre ${itemLabel.toLowerCase()} ${index + 1}`}
              >
                <ChevronDown aria-hidden="true" />
              </button>

              <button
                type="button"
                className="admin-repeater__remove"
                onClick={() => removeAt(index)}
                aria-label={`Supprimer ${itemLabel.toLowerCase()} ${index + 1}`}
              >
                <Trash2 aria-hidden="true" />
              </button>
            </div>
          </header>

          <div className="admin-repeater__grid">
            {fields.map((field) => {
              const id = `${baseId}-${index}-${field.name}`;

              return (
                <div
                  key={field.name}
                  className={`admin-repeater__field${
                    field.wide
                      ? " admin-repeater__field--wide"
                      : ""
                  }`}
                >
                  <label htmlFor={id}>{field.label}</label>

                  {field.type === "select" && (
                    <select
                      id={id}
                      value={item[field.name] ?? ""}
                      onChange={(event) =>
                        patch(index, field.name, event.target.value)
                      }
                    >
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

                  {field.type === "textarea" && (
                    <textarea
                      id={id}
                      rows={field.rows ?? 3}
                      value={item[field.name] ?? ""}
                      placeholder={field.placeholder}
                      onChange={(event) =>
                        patch(index, field.name, event.target.value)
                      }
                    />
                  )}

                  {field.type === "upload" && (
                    <FileField
                      id={id}
                      value={item[field.name] ?? ""}
                      onChange={(next) =>
                        patch(index, field.name, next)
                      }
                      folder={field.folder ?? folder}
                      accept="image"
                    />
                  )}

                  {field.type === "number" && (
                    <input
                      id={id}
                      type="number"
                      min={field.min}
                      max={field.max}
                      value={item[field.name] ?? ""}
                      onChange={(event) =>
                        patch(
                          index,
                          field.name,
                          // Champ vidé : on ne transmet pas NaN, qui
                          // ferait échouer la validation Mongoose.
                          event.target.value === ""
                            ? ""
                            : Number(event.target.value)
                        )
                      }
                    />
                  )}

                  {!["select", "textarea", "upload", "number"].includes(
                    field.type
                  ) && (
                    <input
                      id={id}
                      type="text"
                      value={item[field.name] ?? ""}
                      placeholder={field.placeholder}
                      onChange={(event) =>
                        patch(index, field.name, event.target.value)
                      }
                    />
                  )}

                  {field.help && (
                    <p className="admin-repeater__help">
                      {field.help}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </article>
      ))}

      <div className="admin-repeater__foot">
        <button
          type="button"
          className="admin-repeater__add"
          onClick={add}
          disabled={items.length >= max}
        >
          <Plus aria-hidden="true" />
          {addLabel}
        </button>

        <span className="admin-repeater__count">
          {items.length} / {max}
        </span>
      </div>
    </div>
  );
};

export default RepeaterField;
