import { useCallback, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";

import { newSouls } from "../../../services/api";
import { currentUser } from "../../../services/auth";
import usePageMeta from "../../../hooks/usePageMeta";
import useAsyncData from "../../../hooks/useAsyncData";
import StatusBadge from "../../../components/newSouls/shared/StatusBadge";
import JourneyTimeline from "../../../components/newSouls/shared/JourneyTimeline";
import SOAWizard from "../../../components/newSouls/SOAWizard/SOAWizard";
import CANAWizard from "../../../components/newSouls/CANAWizard/CANAWizard";
import "../../../components/newSouls/shared/NewSouls.scss";

// Rôles autorisés à archiver/reprendre un dossier, selon le côté où il
// se trouve actuellement — mêmes règles que le serveur (voir
// newSoul.service.js#assertCanArchive), reprises ici seulement pour
// masquer le bouton ; la vraie protection reste côté API.
const SOA_SIDE_ARCHIVE_ROLES = ["soa", "admin"];
const CANA_SIDE_ARCHIVE_ROLES = ["cana", "coordinateur_bergeries", "admin"];

// La suppression suit exactement les mêmes droits que l'archivage —
// celui qui peut mettre un dossier de côté peut aussi l'effacer. Les
// listes sont donc réutilisées telles quelles, plutôt que recopiées :
// deux listes séparées auraient fini par diverger.

// Bascule entre le wizard SOA (dossier pas encore transmis) et le
// wizard CANA (dossier transmis, `soa.lockedAt` posé) — la même
// logique que côté serveur (`SOA_EDITABLE_STATUSES`), sans dupliquer
// l'énumération complète des statuts.
const NewSoulDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const role = currentUser()?.role;

  const loader = useCallback(() => newSouls.get(id), [id]);
  const { data: record, loading, error, reload } = useAsyncData(loader);

  const [archiving, setArchiving] = useState(false);
  const [showReasonField, setShowReasonField] = useState(false);
  const [reason, setReason] = useState("");
  const [archiveError, setArchiveError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  usePageMeta({
    title: record ? `Dossier ${record.caseNumber}` : "Nouvelle âme",
    description: "Suivi du dossier SOA/CANA.",
  });

  if (loading) return <p>Chargement…</p>;

  if (error) {
    return (
      <div className="new-soul-list">
        <p className="admin-form__error">{error}</p>
        <Link to="/admin/nouvelles-ames">← Retour à la liste</Link>
      </div>
    );
  }

  if (!record) return null;

  const transmitted = Boolean(record.soa?.lockedAt);
  const isArchived = Boolean(record.archivedAt);
  const isClosed = record.status === "cloture";
  const archiveRoles = transmitted ? CANA_SIDE_ARCHIVE_ROLES : SOA_SIDE_ARCHIVE_ROLES;
  const canArchive = !isClosed && archiveRoles.includes(role);

  // Un dossier clôturé a créé un membre : le serveur refusera de le
  // supprimer (le matricule consommé ne se rend pas). Le bouton est
  // masqué plutôt que de laisser cliquer sur un refus annoncé.
  const canDelete = !isClosed && archiveRoles.includes(role);

  const handleArchive = async () => {
    setArchiving(true);
    setArchiveError("");

    try {
      await newSouls.archive(id, reason);
      setShowReasonField(false);
      setReason("");
      await reload();
    } catch (caught) {
      setArchiveError(caught?.message ?? "Impossible d'archiver ce dossier.");
    } finally {
      setArchiving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setArchiveError("");

    try {
      await newSouls.remove(id);

      // Retour à la liste : la fiche qu'on affichait n'existe plus,
      // rester dessus donnerait un écran d'erreur.
      navigate("/admin/nouvelles-ames", { replace: true });
    } catch (caught) {
      setArchiveError(caught?.message ?? "Impossible de supprimer ce dossier.");
      setConfirmDelete(false);
      setDeleting(false);
    }
  };

  const handleUnarchive = async () => {
    setArchiving(true);
    setArchiveError("");

    try {
      await newSouls.unarchive(id);
      await reload();
    } catch (caught) {
      setArchiveError(caught?.message ?? "Impossible de reprendre ce dossier.");
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div className="new-soul-list">
      <header className="new-soul-list__toolbar">
        <div>
          <Link to="/admin/nouvelles-ames">← Nouvelles âmes</Link>
          <h1>
            {record.caseNumber} — {record.soa?.lastName} {record.soa?.firstName}
          </h1>
        </div>

        <div className="new-soul-list__header-actions">
          <StatusBadge status={record.status} />

          {canArchive && !isArchived && !showReasonField && (
            <button
              type="button"
              className="admin-form__button admin-form__button--ghost"
              onClick={() => setShowReasonField(true)}
            >
              <Archive aria-hidden="true" size={16} />
              Archiver
            </button>
          )}

          {canArchive && isArchived && (
            <button
              type="button"
              className="admin-form__button admin-form__button--ghost"
              disabled={archiving}
              onClick={handleUnarchive}
            >
              <ArchiveRestore aria-hidden="true" size={16} />
              {archiving ? "Reprise…" : "Reprendre le dossier"}
            </button>
          )}

          {/* Suppression en DEUX temps, et non une boîte de dialogue
              `confirm()` : le dossier porte des données personnelles et
              son effacement est définitif. Le second bouton nomme la
              conséquence (« Oui, supprimer définitivement ») plutôt
              qu'un « OK » qu'on clique sans lire. */}
          {canDelete && !confirmDelete && !showReasonField && (
            <button
              type="button"
              className="admin-form__button admin-form__button--ghost"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 aria-hidden="true" size={16} />
              Supprimer
            </button>
          )}

          {canDelete && confirmDelete && (
            <>
              <button
                type="button"
                className="admin-form__button admin-form__button--danger"
                disabled={deleting}
                onClick={handleDelete}
              >
                <Trash2 aria-hidden="true" size={16} />
                {deleting ? "Suppression…" : "Oui, supprimer définitivement"}
              </button>

              <button
                type="button"
                className="admin-form__button admin-form__button--ghost"
                disabled={deleting}
                onClick={() => setConfirmDelete(false)}
              >
                Annuler
              </button>
            </>
          )}
        </div>
      </header>

      {confirmDelete && (
        <p className="new-soul-list__archived-banner" role="alert">
          Le dossier {record.caseNumber} et tout son suivi seront effacés.
          Cette action est définitive. Pour simplement mettre le suivi de
          côté, utilisez « Archiver ».
        </p>
      )}

      {showReasonField && (
        <div className="new-soul-list__archive-form">
          <input
            type="text"
            placeholder="Motif (facultatif) — ex. injoignable, a demandé du temps…"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={archiving}
          />
          <button
            type="button"
            className="admin-form__button"
            disabled={archiving}
            onClick={handleArchive}
          >
            {archiving ? "Archivage…" : "Confirmer l'archivage"}
          </button>
          <button
            type="button"
            className="admin-form__button admin-form__button--ghost"
            disabled={archiving}
            onClick={() => {
              setShowReasonField(false);
              setReason("");
            }}
          >
            Annuler
          </button>
        </div>
      )}

      {archiveError && <p className="admin-form__error">{archiveError}</p>}

      {isArchived && (
        <p className="new-soul-list__archived-banner">
          <Archive aria-hidden="true" size={16} />
          Dossier archivé{record.archivedBy?.name ? ` par ${record.archivedBy.name}` : ""}
          {record.archiveReason ? ` — ${record.archiveReason}` : ""}. Le suivi reste visible
          ci-dessous ; utilisez « Reprendre le dossier » pour continuer.
        </p>
      )}

      <JourneyTimeline status={record.status} statusHistory={record.statusHistory} />

      {transmitted ? (
        <CANAWizard newSoul={record} currentRole={role} onUpdated={reload} />
      ) : (
        <SOAWizard
          newSoul={record}
          onTransmitted={() => {
            reload();
            navigate(`/admin/nouvelles-ames/${id}`, { replace: true });
          }}
        />
      )}
    </div>
  );
};

export default NewSoulDetailPage;
