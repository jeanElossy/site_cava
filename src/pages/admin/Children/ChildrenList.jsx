import { useCallback, useEffect, useState } from "react";

import { Link } from "react-router-dom";

import { Baby, Plus, Search, TriangleAlert } from "lucide-react";

import ChildrenPage, {
  ChildrenStat,
} from "../../../components/children/ChildrenPage";

import ChildrenAvatar from "../../../components/children/ChildrenAvatar";

import {
  AdminEmpty,
  AdminError,
  AdminLoading,
} from "../../../components/admin/AdminFeedback";

import { listChildren, listClasses } from "../../../services/children";

import "./Children.scss";

const PAGE_SIZE = 25;

const formatAge = (child) =>
  typeof child.age === "number" ? `${child.age} ans` : "—";

/**
 * Liste des enfants — recherche, filtres et pagination CÔTÉ SERVEUR.
 *
 * Rien n'est retrié ni refiltré dans le navigateur : la liste est
 * paginée, et retrier une page ne réordonnerait qu'elle. C'est la
 * leçon déjà tirée sur l'annuaire des membres, où des matricules
 * semblaient « sauter » d'une page à l'autre.
 */
const ChildrenList = () => {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [classes, setClasses] = useState([]);

  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState("actif");
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    listClasses({ status: "published" }).then(setClasses).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await listChildren({
        page,
        limit: PAGE_SIZE,
        search: search.trim() || undefined,
        classId: classId || undefined,
        status: status || undefined,
        incompleteOnly: incompleteOnly ? "true" : undefined,
      });

      setItems(result.items);
      setMeta(result.meta);
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, [page, search, classId, status, incompleteOnly]);

  useEffect(() => {
    // Petite temporisation sur la recherche : sans elle, chaque frappe
    // déclenche une requête, et les réponses reviennent dans le
    // désordre — la liste affiche alors le résultat d'une frappe
    // précédente.
    const timer = window.setTimeout(load, search ? 350 : 0);

    return () => window.clearTimeout(timer);
  }, [load, search]);

  // Tout changement de filtre ramène à la première page : rester en
  // page 4 d'un résultat qui n'en compte plus qu'une afficherait une
  // liste vide sans explication.
  const onFilterChange = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  const incompleteCount = items.filter(
    (child) => child.missingFields?.length > 0
  ).length;

  return (
    <ChildrenPage
      title="Enfants"
      breadcrumb={[
        { label: "Administration", to: "/admin" },
        { label: "Enfants", to: "/admin/enfants" },
        { label: "Liste" },
      ]}
      action={
        <Link
          to="/admin/enfants/nouveau"
          className="children-button children-button--primary"
        >
          <Plus aria-hidden="true" />
          Ajouter un enfant
        </Link>
      }
      stats={
        <>
          <ChildrenStat
            icon={Baby}
            value={meta?.total ?? 0}
            label="Enfants trouvés"
          />

          {incompleteCount > 0 && (
            <ChildrenStat
              icon={TriangleAlert}
              value={incompleteCount}
              label="Dossiers à compléter (page affichée)"
              tone="warning"
            />
          )}
        </>
      }
      filters={
        <>
          <label className="children-field children-field--search">
            <span>Rechercher</span>

            <span className="children-field__control">
              <Search aria-hidden="true" />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  onFilterChange(setSearch)(event.target.value)
                }
                placeholder="Nom, prénom ou numéro de dossier"
              />
            </span>
          </label>

          <label className="children-field">
            <span>Classe</span>

            <select
              value={classId}
              onChange={(event) =>
                onFilterChange(setClassId)(event.target.value)
              }
            >
              <option value="">Toutes</option>

              {classes.map((item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="children-field">
            <span>Statut</span>

            <select
              value={status}
              onChange={(event) =>
                onFilterChange(setStatus)(event.target.value)
              }
            >
              <option value="">Tous</option>
              <option value="actif">Actifs</option>
              <option value="inactif">Inactifs</option>
            </select>
          </label>

          <label className="children-field children-field--check">
            <input
              type="checkbox"
              checked={incompleteOnly}
              onChange={(event) =>
                onFilterChange(setIncompleteOnly)(event.target.checked)
              }
            />

            <span>À compléter uniquement</span>
          </label>
        </>
      }
    >
      {loading && <AdminLoading />}

      {error && (
        <AdminError
          message={error.message}
          onRetry={load}
        />
      )}

      {!loading && !error && items.length === 0 && (
        <AdminEmpty message="Aucun enfant ne correspond à cette recherche." />
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="children-table-wrap">
            <table className="children-table">
              <thead>
                <tr>
                  <th>Enfant</th>
                  <th>Numéro de dossier</th>
                  <th>Classe</th>
                  <th>Statut</th>
                </tr>
              </thead>

              <tbody>
                {items.map((child) => (
                  <tr key={child.id}>
                    <td>
                      <span className="children-person">
                        <ChildrenAvatar
                          firstName={child.firstName}
                          lastName={child.lastName}
                          photo={child.photo}
                          size="md"
                        />

                        <span>
                          <Link
                            to={`/admin/enfants/${child.id}`}
                            className="children-table__name"
                          >
                            {child.firstName} {child.lastName}
                          </Link>

                          <em>{formatAge(child)}</em>
                        </span>
                      </span>

                      {child.missingFields?.length > 0 && (
                        <span
                          className="children-badge children-badge--warning"
                          title={`Manque : ${child.missingFields.join(", ")}`}
                        >
                          À compléter
                        </span>
                      )}
                    </td>

                    <td className="children-table__mono">{child.fileNumber}</td>

                    <td>
                      {child.currentClass ? (
                        <span className="children-classcell">
                          <span
                            className="children-classcell__icon"
                            aria-hidden="true"
                          >
                            {child.currentClass.icon || "👶"}
                          </span>

                          <span>
                            <strong>{child.currentClass.name}</strong>

                            {child.currentClass.room && (
                              <em>{child.currentClass.room}</em>
                            )}
                          </span>
                        </span>
                      ) : (
                        <span className="children-table__muted">
                          Non affecté
                        </span>
                      )}
                    </td>

                    <td>
                      <span
                        className={
                          child.status === "actif"
                            ? "children-badge children-badge--success"
                            : "children-badge children-badge--muted"
                        }
                      >
                        {child.status === "actif" ? "Actif" : "Inactif"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta && meta.pages > 1 && (
            <nav
              className="children-pagination"
              aria-label="Pagination"
            >
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={meta.page <= 1}
              >
                Précédent
              </button>

              <span>
                Page {meta.page} sur {meta.pages} — {meta.total} enfant
                {meta.total > 1 ? "s" : ""}
              </span>

              <button
                type="button"
                onClick={() =>
                  setPage((current) => Math.min(meta.pages, current + 1))
                }
                disabled={meta.page >= meta.pages}
              >
                Suivant
              </button>
            </nav>
          )}
        </>
      )}
    </ChildrenPage>
  );
};

export default ChildrenList;
