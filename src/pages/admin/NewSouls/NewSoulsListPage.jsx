import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  HeartHandshake,
  Layers,
  UserPlus,
} from "lucide-react";

import { newSouls } from "../../../services/api";
import { currentUser } from "../../../services/auth";
import usePageMeta from "../../../hooks/usePageMeta";
import useAsyncData from "../../../hooks/useAsyncData";
import { AdminEmpty, AdminError, AdminLoading } from "../../../components/admin/AdminFeedback";
import StatusBadge from "../../../components/newSouls/shared/StatusBadge";
import { STATUS_LABELS } from "../../../components/newSouls/shared/statusLabels";
import "../../../components/newSouls/shared/NewSouls.scss";

const TABS = [
  { id: "overview", label: "Vue d'ensemble" },
  { id: "list", label: "Tous les dossiers" },
];

const formatDate = (value) => (value ? new Date(value).toLocaleDateString("fr-FR") : "—");

const NewSoulsListPage = () => {
  usePageMeta({
    title: "Nouvelles âmes — Administration",
    description: "Suivi des dossiers SOA et CANA.",
  });

  const navigate = useNavigate();
  const role = currentUser()?.role;
  const canCreate = ["soa", "admin"].includes(role);

  const [tab, setTab] = useState("overview");

  // Chiffres clés (tableau de bord) : chargés une fois, indépendamment
  // du filtre/recherche de l'onglet "Tous les dossiers" ci-dessous.
  const statsQuery = useAsyncData(newSouls.stats);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [archived, setArchived] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await newSouls.list({ search, status, archived });
      setItems(data);
    } catch (err) {
      setError(err.message ?? "Impossible de charger les dossiers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(load, 250);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, archived]);

  const handleCreate = async () => {
    setCreating(true);

    try {
      const created = await newSouls.create({});
      navigate(`/admin/nouvelles-ames/${created.id}`);
    } catch (err) {
      setError(err.message ?? "Impossible de créer le dossier.");
      setCreating(false);
    }
  };

  // Depuis la répartition par étape de la vue d'ensemble : bascule
  // directement vers la liste déjà filtrée, plutôt que de dupliquer un
  // second tableau dans l'onglet "Vue d'ensemble".
  const goToStatus = (statusValue) => {
    setStatus(statusValue);
    setTab("list");
  };

  const stats = statsQuery.data;

  const overviewCards = stats && [
    { key: "total", label: "Dossiers suivis", value: stats.total, icon: Layers },
    {
      key: "soaPending",
      label: "En attente de transmission SOA",
      value: stats.soaPending,
      icon: UserPlus,
    },
    {
      key: "canaActive",
      label: "En accompagnement CANA",
      value: stats.canaActive,
      icon: HeartHandshake,
    },
    {
      key: "closedThisMonth",
      label: "Clôturés ce mois-ci",
      value: stats.closedThisMonth,
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="new-soul-list">
      <header>
        <h1>Nouvelles âmes</h1>
        <p className="admin-form__help">Suivi des dossiers SOA et CANA.</p>
      </header>

      <div
        className="new-soul-dashboard__tabs"
        role="tablist"
        aria-label="Sections des nouvelles âmes"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`new-soul-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`new-soul-panel-${item.id}`}
            className={
              tab === item.id
                ? "new-soul-dashboard__tab new-soul-dashboard__tab--active"
                : "new-soul-dashboard__tab"
            }
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div
          className="new-soul-dashboard"
          role="tabpanel"
          id="new-soul-panel-overview"
          aria-labelledby="new-soul-tab-overview"
        >
          {statsQuery.loading && <AdminLoading label="Chargement des statistiques…" />}

          {!statsQuery.loading && statsQuery.error && (
            <AdminError message={statsQuery.error} onRetry={statsQuery.reload} />
          )}

          {!statsQuery.loading && !statsQuery.error && stats && (
            <>
              <ul className="new-soul-dashboard__stats">
                {overviewCards.map((card) => {
                  const Icon = card.icon;

                  return (
                    <li key={card.key}>
                      <div className="new-soul-dashboard__stat">
                        <span className="new-soul-dashboard__stat-icon">
                          <Icon aria-hidden="true" />
                        </span>

                        <span className="new-soul-dashboard__stat-value">{card.value ?? 0}</span>

                        <span className="new-soul-dashboard__stat-label">{card.label}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="new-soul-dashboard__columns">
                <section className="new-soul-dashboard__panel">
                  <h2>Répartition par étape</h2>

                  <ul className="new-soul-dashboard__breakdown">
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <li key={value}>
                        <button type="button" onClick={() => goToStatus(value)}>
                          <StatusBadge status={value} />

                          <span>{label}</span>

                          <strong>{stats.byStatus[value] ?? 0}</strong>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="new-soul-dashboard__panel">
                  <h2>Suivis à venir (14 jours)</h2>

                  {stats.upcomingFollowUps.length === 0 && (
                    <AdminEmpty message="Aucun suivi mensuel prévu dans les 14 prochains jours." />
                  )}

                  {stats.upcomingFollowUps.length > 0 && (
                    <ul className="new-soul-dashboard__followups">
                      {stats.upcomingFollowUps.map((item) => (
                        <li key={`${item.newSoulId}-${item.period}`}>
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/nouvelles-ames/${item.newSoulId}`)}
                          >
                            <span className="new-soul-dashboard__followup-date">
                              {formatDate(item.reviewDate)}
                            </span>

                            <span className="new-soul-dashboard__followup-text">
                              <strong>{item.name || item.caseNumber}</strong>
                              {item.caseNumber} — {item.period}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "list" && (
        <div
          role="tabpanel"
          id="new-soul-panel-list"
          aria-labelledby="new-soul-tab-list"
        >
          <div className="new-soul-list__toolbar">
            <div className="admin-form__field">
              <input
                type="search"
                placeholder="Rechercher (nom, téléphone, numéro de dossier)"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="admin-form__field">
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">Tous les statuts</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <label className="new-soul-list__archived-toggle">
              <input
                type="checkbox"
                checked={archived}
                onChange={(event) => setArchived(event.target.checked)}
              />
              Dossiers archivés
            </label>

            {canCreate && (
              <button
                type="button"
                className="admin-form__button"
                disabled={creating}
                onClick={handleCreate}
              >
                {creating ? "Création…" : "+ Nouvelle âme"}
              </button>
            )}
          </div>

          {error && <p className="admin-form__error">{error}</p>}
          {loading && <p>Chargement…</p>}

          {!loading && items.length === 0 && <p>Aucun dossier pour le moment.</p>}

          {!loading && items.length > 0 && (
            <table className="new-soul-table">
              <thead>
                <tr>
                  <th>Dossier</th>
                  <th>Nom</th>
                  <th>Téléphone</th>
                  <th>Statut</th>
                  <th>Ouvert le</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => navigate(`/admin/nouvelles-ames/${item.id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <td className="new-soul-list__case">{item.caseNumber}</td>
                    <td>
                      {item.soa?.lastName} {item.soa?.firstName}
                    </td>
                    <td>{item.soa?.phone}</td>
                    <td>
                      <StatusBadge status={item.status} />
                      {item.archivedAt && (
                        <span className="new-soul-list__archived-tag">Archivé</span>
                      )}
                    </td>
                    <td>
                      {item.soa?.openedAt
                        ? new Date(item.soa.openedAt).toLocaleDateString("fr-FR")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default NewSoulsListPage;
