import { useCallback, useState } from "react";

import { Download, Mail, Search, Trash2 } from "lucide-react";

import { newsletter } from "../../services/api";
import { apiBaseUrl } from "../../services/http";
import { getToken } from "../../services/http";

import useAsyncData from "../../hooks/useAsyncData";
import usePageMeta from "../../hooks/usePageMeta";

import AdminModal from "../../components/admin/AdminModal";

import {
  AdminEmpty,
  AdminError,
  AdminLoading,
} from "../../components/admin/AdminFeedback";

import "./SubscribersAdmin.scss";

const STATUS_LABELS = {
  confirmed: "Abonné",
  pending: "En attente",
  unsubscribed: "Désinscrit",
};

const formatDate = (value) => {
  if (!value) return "—";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const SubscribersAdmin = () => {
  usePageMeta({
    title: "Lettre d'information — Administration",
    description:
      "Abonnés à la lettre d'information du Centre Apostolique Vie et Abondance.",
  });

  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const load = useCallback(() => newsletter.list(), []);

  const { data, loading, error, reload } = useAsyncData(load);

  const subscribers = data ?? [];

  const visible = subscribers.filter((item) =>
    item.email?.toLowerCase().includes(search.toLowerCase().trim())
  );

  const confirmed = subscribers.filter(
    (item) => item.status === "confirmed"
  ).length;

  const handleDelete = async () => {
    setBusy(true);
    setActionError("");

    try {
      await newsletter.remove(pendingDelete.id ?? pendingDelete._id);

      setPendingDelete(null);

      reload();
    } catch (caught) {
      setActionError(
        caught?.message ?? "La suppression a échoué."
      );
    } finally {
      setBusy(false);
    }
  };

  // L'export passe par `fetch` plutôt qu'un simple lien : la route est
  // protégée, et un `<a href>` n'emporte pas l'en-tête d'autorisation.
  const handleExport = async () => {
    setActionError("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/admin/newsletter/export`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );

      if (!response.ok) {
        throw new Error(`L'export a échoué (code ${response.status}).`);
      }

      const blob = await response.blob();

      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = url;
      link.download = "abonnes-cava.csv";
      link.click();

      URL.revokeObjectURL(url);
    } catch (caught) {
      setActionError(caught?.message ?? "L'export a échoué.");
    }
  };

  return (
    <div className="admin-subs">
      <header className="admin-subs__header">
        <div>
          <h1>Lettre d&apos;information</h1>

          <p>
            Les personnes inscrites depuis le site. Aucune adresse
            n&apos;est supprimée automatiquement.
          </p>
        </div>

        <button
          type="button"
          className="admin-subs__export"
          onClick={handleExport}
          disabled={confirmed === 0}
        >
          <Download aria-hidden="true" />
          Exporter en CSV
        </button>
      </header>

      {/* Honnêteté : la collecte fonctionne, l'envoi n'existe pas. */}
      <div
        className="admin-subs__notice"
        role="note"
      >
        <Mail aria-hidden="true" />

        <p>
          <strong>Aucun e-mail n&apos;est envoyé depuis ce site.</strong>{" "}
          Les adresses sont collectées et conservées ici, mais aucun
          service d&apos;envoi n&apos;est branché. Exportez la liste en
          CSV pour l&apos;utiliser dans un outil dédié — et pensez à y
          inclure un lien de désinscription, sans lequel un envoi est
          juridiquement un courrier non sollicité.
        </p>
      </div>

      {actionError && (
        <p
          className="admin-subs__error"
          role="alert"
        >
          {actionError}
        </p>
      )}

      <div aria-busy={loading}>
        {loading && <AdminLoading label="Chargement des abonnés…" />}

        {!loading && error && (
          <AdminError
            message={error}
            onRetry={reload}
          />
        )}

        {!loading && !error && subscribers.length === 0 && (
          <AdminEmpty message="Aucun abonné pour le moment. Les inscriptions faites depuis le site apparaîtront ici." />
        )}

        {!loading && !error && subscribers.length > 0 && (
          <>
            <div className="admin-subs__bar">
              <div className="admin-subs__search">
                <Search aria-hidden="true" />

                <label
                  className="admin-subs__sr"
                  htmlFor="admin-subs-search"
                >
                  Rechercher une adresse
                </label>

                <input
                  id="admin-subs-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Rechercher une adresse…"
                />
              </div>

              <span className="admin-subs__count">
                {confirmed} abonné{confirmed > 1 ? "s" : ""} sur{" "}
                {subscribers.length} adresse
                {subscribers.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className="admin-subs__table-wrapper">
              <table className="admin-subs__table">
                <thead>
                  <tr>
                    <th>Adresse e-mail</th>
                    <th>Statut</th>
                    <th>Origine</th>
                    <th>Inscrit le</th>
                    <th>
                      <span className="admin-subs__sr">Actions</span>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {visible.map((item) => (
                    <tr key={item.id ?? item._id}>
                      <td>{item.email}</td>

                      <td>
                        <span
                          className={`admin-subs__pill admin-subs__pill--${item.status}`}
                        >
                          {STATUS_LABELS[item.status] ?? item.status}
                        </span>
                      </td>

                      <td className="admin-subs__muted">
                        {item.source ?? "—"}
                      </td>

                      <td className="admin-subs__muted">
                        {formatDate(item.createdAt)}
                      </td>

                      <td>
                        <div className="admin-subs__actions">
                          <button
                            type="button"
                            onClick={() => setPendingDelete(item)}
                            aria-label={`Supprimer ${item.email}`}
                          >
                            <Trash2 aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {visible.length === 0 && (
              <p className="admin-subs__nothing">
                Aucune adresse ne correspond à cette recherche.
              </p>
            )}
          </>
        )}
      </div>

      {pendingDelete && (
        <AdminModal
          title="Supprimer cette adresse ?"
          description="L'adresse sera définitivement retirée de la liste."
          onClose={() => setPendingDelete(null)}
        >
          <p className="admin-subs__confirm">
            <strong>{pendingDelete.email}</strong> ne recevra plus
            aucune actualité et disparaîtra de vos exports.
          </p>

          <div className="admin-subs__confirm-actions">
            <button
              type="button"
              className="admin-subs__ghost"
              onClick={() => setPendingDelete(null)}
              disabled={busy}
            >
              Annuler
            </button>

            <button
              type="button"
              className="admin-subs__danger"
              onClick={handleDelete}
              disabled={busy}
            >
              {busy ? "Suppression…" : "Supprimer"}
            </button>
          </div>
        </AdminModal>
      )}
    </div>
  );
};

export default SubscribersAdmin;
