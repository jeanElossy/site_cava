import { useState } from "react";

import { Pencil, Plus, Trash2 } from "lucide-react";

import useCrud from "../../../hooks/useCrud";

import AdminForm from "../AdminForm";
import AdminModal from "../AdminModal";

import {
  AdminEmpty,
  AdminError,
  AdminLoading,
} from "../AdminFeedback";

import "./AdminCrud.scss";

const defaultToValues = (fields, item) =>
  fields.reduce((accumulator, field) => {
    accumulator[field.name] =
      item?.[field.name] ??
      (field.type === "checkbox" ? false : "");

    return accumulator;
  }, {});

/**
 * Écran CRUD générique : liste, création, modification, suppression.
 *
 * Chaque écran d'administration décrit ses colonnes et ses champs ;
 * la mécanique asynchrone (chargement, erreur, liste vide, écriture en
 * cours) est traitée ici une seule fois.
 */
const AdminCrud = ({
  resource,
  fields,
  columns,
  labels,
  toValues,
  toPayload,
  rowKey = "id",
}) => {
  const {
    items,
    loading,
    error,
    reload,
    busy,
    actionError,
    clearActionError,
    create,
    update,
    remove,
  } = useCrud(resource);

  const [editing, setEditing] = useState(null);
  const [values, setValues] = useState({});
  const [pendingDelete, setPendingDelete] = useState(null);

  const buildValues = (item) =>
    toValues ? toValues(item) : defaultToValues(fields, item);

  const openCreate = () => {
    clearActionError();
    setEditing({ mode: "create" });
    setValues(buildValues(null));
  };

  const openEdit = (item) => {
    clearActionError();
    setEditing({ mode: "edit", item });
    setValues(buildValues(item));
  };

  const closeForm = () => {
    setEditing(null);
    clearActionError();
  };

  const handleChange = (name, value) => {
    setValues((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async () => {
    const payload = toPayload ? toPayload(values) : values;

    const result =
      editing.mode === "create"
        ? await create(payload)
        : await update(editing.item[rowKey], payload);

    // `useCrud` a déjà exposé l'erreur : on garde la fenêtre ouverte
    // pour ne pas faire perdre la saisie.
    if (result !== null) {
      closeForm();
    }
  };

  const handleDelete = async () => {
    const result = await remove(pendingDelete[rowKey]);

    if (result !== null) {
      setPendingDelete(null);
    }
  };

  return (
    <section className="admin-crud">
      <header className="admin-crud__header">
        <div>
          <h1>{labels.plural}</h1>

          {labels.description && <p>{labels.description}</p>}
        </div>

        <button
          type="button"
          className="admin-crud__add"
          onClick={openCreate}
        >
          <Plus aria-hidden="true" />

          {labels.add ?? `Ajouter ${labels.singular}`}
        </button>
      </header>

      {actionError && !editing && !pendingDelete && (
        <p
          className="admin-crud__alert"
          role="alert"
        >
          {actionError}
        </p>
      )}

      <div
        className="admin-crud__body"
        aria-busy={loading}
      >
        {loading && (
          <AdminLoading
            label={`Chargement ${labels.loadingSuffix ?? "des données"}…`}
          />
        )}

        {!loading && error && (
          <AdminError
            message={error}
            onRetry={reload}
          />
        )}

        {!loading && !error && items.length === 0 && (
          <AdminEmpty
            message={labels.empty}
            action={
              <button
                type="button"
                className="admin-crud__add admin-crud__add--inline"
                onClick={openCreate}
              >
                <Plus aria-hidden="true" />

                {labels.add ?? `Ajouter ${labels.singular}`}
              </button>
            }
          />
        )}

        {!loading && !error && items.length > 0 && (
          <div className="admin-crud__table-wrapper">
            <table className="admin-crud__table">
              <caption className="sr-only">
                {labels.plural} — {items.length} élément
                {items.length > 1 ? "s" : ""}
              </caption>

              <thead>
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                    >
                      {column.label}
                    </th>
                  ))}

                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => (
                  <tr key={item[rowKey]}>
                    {columns.map((column) => (
                      <td key={column.key}>
                        {column.render
                          ? column.render(item)
                          : item[column.key] || "—"}
                      </td>
                    ))}

                    <td className="admin-crud__row-actions">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        aria-label={`Modifier : ${
                          item[labels.titleKey ?? "title"] ?? "élément"
                        }`}
                      >
                        <Pencil aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        className="admin-crud__danger"
                        onClick={() => setPendingDelete(item)}
                        aria-label={`Supprimer : ${
                          item[labels.titleKey ?? "title"] ?? "élément"
                        }`}
                      >
                        <Trash2 aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <AdminModal
          title={
            editing.mode === "create"
              ? `Ajouter ${labels.singular}`
              : `Modifier ${labels.singular}`
          }
          description={labels.formDescription}
          onClose={closeForm}
        >
          <AdminForm
            fields={fields}
            values={values}
            onChange={handleChange}
            onSubmit={handleSubmit}
            onCancel={closeForm}
            busy={busy}
            error={actionError}
          />
        </AdminModal>
      )}

      {pendingDelete && (
        <AdminModal
          title="Confirmer la suppression"
          onClose={() => setPendingDelete(null)}
        >
          <p className="admin-crud__confirm">
            Voulez-vous vraiment supprimer «&nbsp;
            {pendingDelete[labels.titleKey ?? "title"] ?? "cet élément"}
            &nbsp;» ? Cette action est définitive.
          </p>

          {actionError && (
            <p
              className="admin-crud__alert"
              role="alert"
            >
              {actionError}
            </p>
          )}

          <div className="admin-crud__confirm-actions">
            <button
              type="button"
              className="admin-crud__ghost"
              onClick={() => setPendingDelete(null)}
              disabled={busy}
            >
              Annuler
            </button>

            <button
              type="button"
              className="admin-crud__danger-solid"
              onClick={handleDelete}
              disabled={busy}
              aria-busy={busy}
            >
              {busy ? "Suppression…" : "Supprimer"}
            </button>
          </div>
        </AdminModal>
      )}
    </section>
  );
};

export default AdminCrud;
