import { useEffect, useState } from "react";

import { Pencil, Plus, Search, Trash2 } from "lucide-react";

import useCrud from "../../../hooks/useCrud";

import AdminForm from "../AdminForm";
import AdminModal from "../AdminModal";

import {
  AdminEmpty,
  AdminError,
  AdminLoading,
} from "../AdminFeedback";

import "./AdminCrud.scss";

// Valeur de départ d'un champ vide, selon son type.
//
// Le type compte : une galerie attend un TABLEAU. Lui donner la chaîne
// vide par défaut l'enverrait telle quelle à l'API au premier
// enregistrement, et Mongoose refuserait — ou pire, écraserait une
// galerie existante par une valeur mal typée.
const emptyValueFor = (field) => {
  if (field.type === "checkbox") return false;

  if (field.type === "gallery" || field.type === "repeater") return [];

  return "";
};

const defaultToValues = (fields, item) =>
  fields.reduce((accumulator, field) => {
    accumulator[field.name] =
      item?.[field.name] ?? emptyValueFor(field);

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
  // Optionnel : `admin-crud__table--fixed` fige la largeur des
  // colonnes (voir `column.width` ci-dessous) au lieu de les laisser
  // s'ajuster au contenu — utile quand certaines colonnes wrappent
  // sur plusieurs lignes alors que d'autres ont trop de place (ex. la
  // liste des membres). N'affecte que les écrans qui le demandent
  // explicitement ; tous les autres gardent leur comportement actuel.
  tableClassName,
  // Optionnel : `(item, { onEdit, onDelete, reload }) => JSX` remplace
  // les deux boutons Modifier/Supprimer par défaut par un rendu
  // personnalisé — utilisé par la liste des membres pour regrouper
  // Modifier, Supprimer, le téléchargement de la carte ET la bascule
  // rapide de statut dans un seul menu, sans dupliquer la logique
  // d'édition/suppression déjà gérée ici. `reload` permet à une action
  // qui écrit directement (hors formulaire d'édition) de rafraîchir la
  // liste ensuite. Les écrans qui ne le fournissent pas gardent le
  // rendu par défaut.
  rowActions,
  // Optionnel : `(item) => string` ajoute une classe CSS par ligne —
  // utilisé par la liste des membres pour griser visuellement un
  // membre désactivé, sans imposer cette notion de statut aux autres
  // écrans qui ne la connaissent pas.
  rowClassName,
  // Optionnel : objet fusionné dans les paramètres envoyés à
  // `listAdmin` (ex. `{ church, flock }` pour la liste des membres) —
  // recréer cet objet à chaque rendu ne pose pas de problème, `useCrud`
  // compare son CONTENU, pas sa référence.
  listParams,
  // Optionnel : affiche un champ de recherche au-dessus du tableau,
  // relié au paramètre `search` déjà supporté par `listAdmin` côté
  // serveur (voir crud.service.js#buildSearch). Anti-rebond intégré :
  // aucune requête à chaque frappe.
  searchable = false,
  searchPlaceholder = "Rechercher…",
  // Nombre de lignes par page. L'API plafonne à 100
  // (crud.service.js#MAX_LIMIT) : au-delà, elle tronquerait sans le
  // dire.
  pageSize = 20,
}) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);

    return () => window.clearTimeout(timer);
  }, [search]);

  // Changer de recherche ou de filtre remet à la première page : rester
  // page 4 sur un résultat qui n'en compte que 2 afficherait un tableau
  // vide sans explication. Ajusté PENDANT le rendu (et non dans un
  // effet) pour ne jamais afficher, même un instant, la mauvaise page —
  // même pattern que `SocialCaisse.jsx#church`.
  const filtersKey = JSON.stringify({ listParams, debouncedSearch });
  const [lastFiltersKey, setLastFiltersKey] = useState(filtersKey);

  if (filtersKey !== lastFiltersKey) {
    setLastFiltersKey(filtersKey);
    setPage(1);
  }

  const listAdminParams = {
    ...listParams,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    page,
    limit: pageSize,
  };

  const {
    items: rawItems,
    meta,
    loading,
    error,
    reload,
    busy,
    actionError,
    actionDetails,
    clearActionError,
    create,
    update,
    remove,
  } = useCrud(resource, listAdminParams);

  // L'ORDRE VIENT DU SERVEUR, jamais d'un retri local.
  //
  // Un tri appliqué ici ne porterait que sur la page affichée : la
  // liste des membres, triée dans le navigateur par ordre de
  // matricule, réordonnait en réalité une tranche déjà découpée par
  // l'API selon un tout autre critère — d'où des numéros qui
  // paraissaient sauter. Chaque ressource déclare donc son
  // `defaultSort` côté API (voir routes/index.js).
  const items = rawItems;

  const totalItems = meta?.total ?? rawItems.length;
  const totalPages = Math.max(meta?.pages ?? 1, 1);

  // Supprimer le dernier élément d'une page peut laisser la pagination
  // au-delà de la dernière page existante : on y revient plutôt que
  // d'afficher un tableau vide.
  if (page > totalPages) setPage(totalPages);

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

      {searchable && (
        <div className="admin-crud__search">
          <Search aria-hidden="true" />

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
        </div>
      )}

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
            <table
              className={
                tableClassName
                  ? `admin-crud__table ${tableClassName}`
                  : "admin-crud__table"
              }
            >
              <caption className="sr-only">
                {labels.plural} — {totalItems} élément
                {totalItems > 1 ? "s" : ""}
                {totalPages > 1 ? ` (page ${page} sur ${totalPages})` : ""}
              </caption>

              <thead>
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      style={column.width ? { width: column.width } : undefined}
                    >
                      {column.label}
                    </th>
                  ))}

                  <th scope="col" className="admin-crud__actions-col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => (
                  <tr
                    key={item[rowKey]}
                    className={rowClassName?.(item) || undefined}
                  >
                    {columns.map((column) => (
                      // `data-label` : sous 760 px, chaque ligne devient
                      // une carte et cet intitulé remplace l'en-tête de
                      // colonne, disparu (voir le mixin
                      // `admin-stacked-table`). Une chaîne, pas le nœud
                      // React du libellé : `attr()` en CSS ne sait lire
                      // qu'une valeur d'attribut.
                      <td
                        key={column.key}
                        data-label={
                          typeof column.label === "string" ? column.label : undefined
                        }
                        style={column.width ? { width: column.width } : undefined}
                      >
                        {column.render
                          ? column.render(item)
                          : item[column.key] || "—"}
                      </td>
                    ))}

                    <td className="admin-crud__row-actions">
                      {rowActions ? (
                        rowActions(item, {
                          onEdit: () => openEdit(item),
                          onDelete: () => setPendingDelete(item),
                          // Pour une action qui modifie l'élément sans
                          // passer par le formulaire d'édition (ex. bascule
                          // rapide d'un statut) — sans ça, la ligne
                          // resterait affichée avec sa valeur périmée
                          // jusqu'au prochain rechargement manuel.
                          reload,
                        })
                      ) : (
                        <>
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
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && totalPages > 1 && (
          <nav
            className="admin-crud__pagination"
            aria-label={`Pagination — ${labels.plural}`}
          >
            <button
              type="button"
              onClick={() => setPage((previous) => Math.max(previous - 1, 1))}
              disabled={page <= 1}
            >
              Précédent
            </button>

            <span aria-live="polite">
              Page {page} sur {totalPages}
              <small>{totalItems} au total</small>
            </span>

            <button
              type="button"
              onClick={() =>
                setPage((previous) => Math.min(previous + 1, totalPages))
              }
              disabled={page >= totalPages}
            >
              Suivant
            </button>
          </nav>
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
            errorDetails={actionDetails}
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
