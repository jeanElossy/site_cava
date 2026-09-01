import { useCallback, useState } from "react";

import { Activity, Eye } from "lucide-react";

import ChildrenPage, {
  ChildrenPanel,
  ChildrenStat,
} from "../../../components/children/ChildrenPage";

import ChildrenAvatar from "../../../components/children/ChildrenAvatar";

import {
  AdminEmpty,
  AdminError,
  AdminLoading,
} from "../../../components/admin/AdminFeedback";

import useAsyncData from "../../../hooks/useAsyncData";

import { childrenHistory } from "../../../services/children";

import { formatLongDate, relativeDay } from "../../../utils/childrenDates";

import "./Children.scss";

// Libellés lisibles des actions journalisées. Le journal stocke des
// codes ; l'écran doit dire ce qui s'est passé, pas montrer un
// identifiant technique.
const ACTIONS = {
  create: { label: "Création", tone: "success" },
  update: { label: "Modification", tone: "info" },
  delete: { label: "Suppression", tone: "danger" },
  document_view: { label: "Consultation d'un document", tone: "warning" },
  document_upload: { label: "Ajout d'un document", tone: "success" },
  document_delete: { label: "Suppression d'un document", tone: "danger" },
  attendance_update: { label: "Correction d'une présence", tone: "info" },
  substitution_create: { label: "Remplacement créé", tone: "success" },
  substitution_cancel: { label: "Remplacement annulé", tone: "danger" },
  password_change: { label: "Mot de passe réinitialisé", tone: "warning" },
};

const RESOURCES = {
  child: "Enfant",
  childStatus: "Statut d'un enfant",
  childClass: "Classe d'un enfant",
  childClassArchive: "Archivage d'une classe",
  childGuardian: "Responsable",
  childGuardianLink: "Lien enfant / responsable",
  childDocument: "Document",
  childAttendance: "Présence",
  childSession: "Séance",
  monitorAssignment: "Affectation de moniteur",
  monitorAssignmentWithdraw: "Retrait de fonction",
  monitorAccount: "Accès moniteur",
  monitorAccountRevoke: "Retrait d'accès",
  monitorSubstitution: "Remplacement",
  monitorSubstitutionUpdate: "Modification d'un remplacement",
};

const FILTERS = [
  { key: "", label: "Toutes" },
  { key: "document_view", label: "Consultations de documents" },
  { key: "attendance_update", label: "Corrections de présence" },
  { key: "substitution_create", label: "Remplacements" },
  { key: "delete", label: "Suppressions" },
];

/**
 * Historique du module Enfants.
 *
 * Lecture du journal d'audit, RESTREINTE côté serveur aux ressources
 * du module : le responsable de l'École du dimanche n'y voit ni les
 * connexions, ni les dons, ni le Service Social.
 *
 * Le filtre le plus utile n'est pas « toutes les actions » mais
 * « consultations de documents » : c'est la question qu'on se pose
 * vraiment sur un dossier d'enfant — qui a ouvert cet acte de
 * naissance, et quand.
 */
const HistoryAdmin = () => {
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(
    () => childrenHistory({ action: action || undefined, page, limit: 30 }),
    [action, page]
  );

  const { data, loading, error, reload } = useAsyncData(load);

  const items = data?.items ?? [];
  const meta = data?.meta ?? null;

  const documentViews = items.filter(
    (entry) => entry.action === "document_view"
  ).length;

  return (
    <ChildrenPage
      title="Historique"
      breadcrumb={[
        { label: "Administration", to: "/admin" },
        { label: "Enfants", to: "/admin/enfants" },
        { label: "Historique" },
      ]}
      stats={
        <>
          <ChildrenStat
            icon={Activity}
            value={meta?.total ?? 0}
            label="Actions enregistrées"
          />

          <ChildrenStat
            icon={Eye}
            value={documentViews}
            label="Consultations de documents (page affichée)"
            tone="warning"
          />
        </>
      }
      filters={
        <div
          className="children-tabs"
          role="tablist"
        >
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={action === item.key}
              className={
                action === item.key
                  ? "children-tabs__tab children-tabs__tab--active"
                  : "children-tabs__tab"
              }
              onClick={() => {
                setAction(item.key);
                setPage(1);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      }
      aside={
        <ChildrenPanel title="Ce que le journal conserve">
          <p className="children-note">
            <strong>Qui</strong> a fait <strong>quoi</strong>, et{" "}
            <strong>sur quoi</strong> — jamais le contenu détaillé des
            modifications : le recopier dupliquerait des données personnelles
            dans une seconde collection.
          </p>

          <p className="children-note">
            Les traces sont conservées <strong>douze mois</strong>, puis
            effacées automatiquement. Un journal de sécurité doit couvrir une
            période utile à une enquête, sans devenir lui-même un stock de
            données personnelles indéfini.
          </p>
        </ChildrenPanel>
      }
    >
      {loading && <AdminLoading />}

      {error && (
        <AdminError
          message={error}
          onRetry={reload}
        />
      )}

      {!loading && !error && items.length === 0 && (
        <AdminEmpty message="Aucune action enregistrée pour ce filtre." />
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="children-table-wrap">
            <table className="children-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Utilisateur</th>
                  <th>Action</th>
                  <th>Ressource</th>
                </tr>
              </thead>

              <tbody>
                {items.map((entry) => {
                  const meta_ = ACTIONS[entry.action] ?? {
                    label: entry.action,
                    tone: "muted",
                  };

                  const name = entry.actor?.name ?? entry.actorEmail ?? "—";

                  return (
                    <tr key={entry._id ?? entry.id}>
                      <td>
                        <span className="children-daycell">
                          <span className="children-daycell__date">
                            {formatLongDate(entry.createdAt)}
                          </span>

                          <span
                            className={
                              relativeDay(entry.createdAt)
                                ? "children-daycell__relative"
                                : "children-daycell__range"
                            }
                          >
                            {relativeDay(entry.createdAt) ??
                              new Date(entry.createdAt).toLocaleTimeString(
                                "fr-FR",
                                { hour: "2-digit", minute: "2-digit" }
                              )}
                          </span>
                        </span>
                      </td>

                      <td>
                        <span className="children-person">
                          <ChildrenAvatar
                            firstName={name.split(" ")[0]}
                            lastName={name.split(" ")[1]}
                            size="sm"
                          />

                          <span>
                            <strong>{name}</strong>

                            {entry.actor?.role && <em>{entry.actor.role}</em>}
                          </span>
                        </span>
                      </td>

                      <td>
                        <span
                          className={`children-badge children-badge--${meta_.tone}`}
                        >
                          {meta_.label}
                        </span>
                      </td>

                      <td>
                        <span className="children-daycell">
                          <span className="children-daycell__date">
                            {RESOURCES[entry.resource] ?? entry.resource ?? "—"}
                          </span>

                          {entry.resourceId && (
                            <span className="children-daycell__range">
                              {entry.resourceId}
                            </span>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
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
                Page {meta.page} sur {meta.pages} — {meta.total} action
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

export default HistoryAdmin;
