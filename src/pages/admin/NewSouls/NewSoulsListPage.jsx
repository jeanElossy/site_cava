import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { newSouls } from "../../../services/api";
import { currentUser } from "../../../services/auth";
import usePageMeta from "../../../hooks/usePageMeta";
import StatusBadge from "../../../components/newSouls/shared/StatusBadge";
import { STATUS_LABELS } from "../../../components/newSouls/shared/statusLabels";
import "../../../components/newSouls/shared/NewSouls.scss";

const NewSoulsListPage = () => {
  usePageMeta({
    title: "Nouvelles âmes — Administration",
    description: "Suivi des dossiers SOA et CANA.",
  });

  const navigate = useNavigate();
  const role = currentUser()?.role;
  const canCreate = ["soa", "admin"].includes(role);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await newSouls.list({ search, status });
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
  }, [search, status]);

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

  return (
    <div className="new-soul-list">
      <header>
        <h1>Nouvelles âmes</h1>
        <p className="admin-form__help">Suivi des dossiers SOA et CANA.</p>
      </header>

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
  );
};

export default NewSoulsListPage;
