import { useCallback, useState } from "react";

import {
  AlertCircle,
  Ban,
  Clock,
  Download,
  History,
  Loader2,
  Plus,
  QrCode as QrCodeIcon,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";

import { events } from "../../services/api";
import {
  adminAttendanceCounts,
  adminGeneratePresenceQr,
  adminListAttendance,
  adminPresenceQrHistory,
  adminPresenceQrImage,
  adminListPresenceQrs,
  adminDeletePresenceQr,
  adminRevokePresenceQr,
  downloadAttendancePdf,
  downloadAttendanceXlsx,
} from "../../services/presences";

import useAsyncData from "../../hooks/useAsyncData";
import usePageMeta from "../../hooks/usePageMeta";
import { formatRegistrationNumber } from "../../utils/registrationNumber";

import AdminModal from "../../components/admin/AdminModal";
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
} from "../../components/admin/AdminFeedback";

import "./PresencesAdmin.scss";

const STATUS_LABELS = {
  pending: "En attente",
  active: "Actif",
  expired: "Expiré",
  revoked: "Révoqué",
};

// Durée affichée en heures/minutes plutôt qu'en minutes brutes — ce
// que l'admin a réellement saisi à la création.
const formatDuration = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;

  return `${hours} h ${rest} min`;
};

// Un QR "en attente" (jamais scanné) n'a pas encore de fenêtre
// concrète — `validFrom`/`validUntil` valent `null` (voir
// presenceQr.service.js#serialize) : on décrit alors sa durée prévue
// et, s'il y en a une, la date à partir de laquelle il devient
// activable, plutôt que d'afficher des dates vides.
const describeWindow = (qr) => {
  if (qr.validFrom) {
    return `${formatDateTime(qr.validFrom)} → ${formatDateTime(qr.validUntil)}`;
  }

  const duration = formatDuration(qr.durationMinutes);

  return qr.notBefore
    ? `En attente — activable à partir du ${formatDateTime(qr.notBefore)} (${duration})`
    : `En attente du premier scan (${duration})`;
};

const formatDateTime = (value) => {
  if (!value) return "—";

  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// `<input type="datetime-local">` attend "AAAA-MM-JJTHH:mm", en heure
// locale — sans conversion, le champ s'affiche vide ou décalé.
const toLocalInputValue = (date) => {
  const pad = (n) => String(n).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const PresencesAdmin = () => {
  usePageMeta({
    title: "Badgeage des présences — Administration",
    description:
      "Génération et suivi des QR de sécurité du badgeage des membres du Centre Apostolique Vie et Abondance.",
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [detailQr, setDetailQr] = useState(null);

  const load = useCallback(() => adminListPresenceQrs(), []);
  const { data, loading, error, refreshing, reload } = useAsyncData(load);

  const qrs = data ?? [];

  return (
    <div className="admin-presences">
      <header className="admin-presences__header">
        <div>
          <h1>Badgeage des présences</h1>

          <p>
            Générez le QR de sécurité d&apos;un service, suivez qui
            l&apos;utilise et les présences enregistrées.
          </p>
        </div>

        <div className="admin-presences__header-actions">
          <button
            type="button"
            className="admin-presences__generate"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={17} aria-hidden="true" />
            Générer un QR
          </button>

          {/* La liste reste affichée pendant le rechargement (voir
              useAsyncData) : sans l'icône qui tourne et le libellé qui
              change, un clic sur une liste inchangée ne produit aucun
              effet visible — le bouton passe pour cassé. */}
          <button
            type="button"
            className="admin-presences__refresh"
            onClick={reload}
            disabled={refreshing}
          >
            <RefreshCw
              size={17}
              aria-hidden="true"
              className={refreshing ? "admin-presences__spin" : undefined}
            />
            {refreshing ? "Actualisation…" : "Actualiser"}
          </button>
        </div>
      </header>

      {loading && <AdminLoading />}
      {error && (
        <AdminError
          message={error}
          onRetry={reload}
        />
      )}

      {!loading && !error && qrs.length === 0 && (
        <AdminEmpty message="Aucun QR de sécurité généré pour l'instant." />
      )}

      {!loading && !error && qrs.length > 0 && (
        <div className="admin-presences__list">
          {qrs.map((qr) => (
            <article
              key={qr.id}
              className="admin-presences__card"
            >
              <span
                className="admin-presences__card-status"
                data-status={qr.computedStatus}
              >
                {STATUS_LABELS[qr.computedStatus] ?? qr.computedStatus}
              </span>

              <h2>{qr.label}</h2>

              <p className="admin-presences__card-window">
                <Clock
                  size={14}
                  aria-hidden="true"
                />
                {describeWindow(qr)}
              </p>

              <button
                type="button"
                className="admin-presences__card-open"
                onClick={() => setDetailQr(qr)}
              >
                <QrCodeIcon
                  size={15}
                  aria-hidden="true"
                />
                Détails
              </button>
            </article>
          ))}
        </div>
      )}

      {createOpen && (
        <CreateQrModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            reload();
          }}
        />
      )}

      {detailQr && (
        <QrDetailModal
          qr={detailQr}
          onClose={() => setDetailQr(null)}
          onRevoked={reload}
          onDeleted={reload}
        />
      )}
    </div>
  );
};

// ------------------------------------------------------------------
// Génération d'un QR de sécurité
// ------------------------------------------------------------------
const CreateQrModal = ({ onClose, onCreated }) => {
  const eventsLoad = useCallback(() => events.listAdmin(), []);
  const { data: eventList } = useAsyncData(eventsLoad);

  const [label, setLabel] = useState("");
  const [eventId, setEventId] = useState("");
  // Durée en HEURES, saisie décimale acceptée (1.5 = 1h30) — convertie
  // en minutes à l'envoi, seule unité que le serveur connaît (voir
  // PresenceSecurityQr.js#durationMinutes).
  const [durationHours, setDurationHours] = useState("4");
  // Vide par défaut : le QR est activable dès sa création. Un admin
  // qui génère plusieurs QR à l'avance, à imprimer et déposer avant le
  // jour J, peut ici empêcher toute activation prématurée (scan par
  // erreur ou curiosité avant l'événement réel).
  const [notBefore, setNotBefore] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Choisir un événement pré-remplit le libellé et, s'ils existent,
  // l'heure de début (comme date minimale d'activation) et la durée —
  // un simple confort, jamais un lien obligatoire (voir la spec : la
  // fenêtre de badgeage diffère souvent de l'horaire affiché de
  // l'événement, ex. accueil dès 07h30 pour un culte à 08h30).
  const handleEventChange = (id) => {
    setEventId(id);

    const found = eventList?.find((item) => item.id === id);
    if (!found) return;

    setLabel(found.title);

    if (found.startAt) {
      setNotBefore(toLocalInputValue(new Date(found.startAt)));
    }
    if (found.startAt && found.endAt) {
      const hours =
        (new Date(found.endAt).getTime() - new Date(found.startAt).getTime()) /
        (60 * 60 * 1000);

      if (hours > 0) setDurationHours(String(Math.round(hours * 4) / 4));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (busy) return;

    setBusy(true);
    setError("");

    try {
      const hours = Number(durationHours);

      if (!Number.isFinite(hours) || hours <= 0) {
        throw new Error("La durée doit être un nombre d'heures positif.");
      }

      await adminGeneratePresenceQr({
        label,
        event: eventId || undefined,
        durationMinutes: Math.round(hours * 60),
        notBefore: notBefore ? new Date(notBefore).toISOString() : undefined,
      });

      onCreated();
    } catch (caught) {
      setError(caught?.message ?? "La génération a échoué.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminModal
      title="Générer un QR de sécurité"
      description="Ce QR sera affiché dans la salle du Service d'Ordre. Les agents le scannent pour accéder au scanner de badgeage."
      onClose={onClose}
    >
      <form
        className="admin-presences__form"
        onSubmit={handleSubmit}
      >
        <label>
          <span>Événement (facultatif)</span>

          <select
            value={eventId}
            onChange={(event) => handleEventChange(event.target.value)}
          >
            <option value="">Aucun — libellé libre</option>

            {(eventList ?? []).map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.title}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Libellé</span>

          <input
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Ex : Culte du dimanche 8h30"
            required
            disabled={busy}
          />
        </label>

        <div className="admin-presences__form-row">
          <label>
            <span>Durée de validité (heures)</span>

            <input
              type="number"
              min="0.25"
              step="0.25"
              value={durationHours}
              onChange={(event) => setDurationHours(event.target.value)}
              required
              disabled={busy}
            />
          </label>

          <label>
            <span>Activable à partir de (facultatif)</span>

            <input
              type="datetime-local"
              value={notBefore}
              onChange={(event) => setNotBefore(event.target.value)}
              disabled={busy}
            />
          </label>
        </div>

        <p className="admin-presences__form-hint">
          Le compte à rebours ne démarre pas à la création : la durée
          court à partir du tout premier scan par un agent. Générez et
          imprimez plusieurs QR à l&apos;avance sans risque — chacun
          reste « en attente » tant que personne ne l&apos;a scanné.
        </p>

        {error && (
          <p
            className="admin-presences__form-error"
            role="alert"
          >
            <AlertCircle
              size={16}
              aria-hidden="true"
            />
            {error}
          </p>
        )}

        <button
          type="submit"
          className="admin-presences__form-submit"
          disabled={busy}
        >
          {busy ? (
            <Loader2
              className="admin-presences__spin"
              size={16}
              aria-hidden="true"
            />
          ) : (
            <Plus
              size={16}
              aria-hidden="true"
            />
          )}
          {busy ? "Génération…" : "Générer le QR"}
        </button>
      </form>
    </AdminModal>
  );
};

// ------------------------------------------------------------------
// Détail d'un QR : image à imprimer, historique de connexion, révocation
// ------------------------------------------------------------------
const QrDetailModal = ({ qr, onClose, onRevoked, onDeleted }) => {
  const imageLoad = useCallback(() => adminPresenceQrImage(qr.id), [qr.id]);
  const { data: image, loading: imageLoading } = useAsyncData(imageLoad);

  const historyLoad = useCallback(() => adminPresenceQrHistory(qr.id), [qr.id]);
  const { data: history, loading: historyLoading } = useAsyncData(historyLoad);

  const attendanceLoad = useCallback(
    () => adminListAttendance({ securityQr: qr.id }),
    [qr.id]
  );
  const { data: attendance, loading: attendanceLoading } = useAsyncData(
    attendanceLoad
  );

  const countsLoad = useCallback(() => adminAttendanceCounts(qr.id), [qr.id]);
  const { data: counts } = useAsyncData(countsLoad);

  const [revoking, setRevoking] = useState(false);
  const [revoked, setRevoked] = useState(qr.status === "revoked");

  // "xlsx" | "pdf" | "" — distingue quel bouton est occupé, les deux
  // exports pouvant être déclenchés indépendamment.
  const [exporting, setExporting] = useState("");
  const [exportError, setExportError] = useState("");

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  // Passe à `true` quand le serveur a refusé faute de confirmation :
  // le bouton demande alors une seconde pression, en annonçant ce qui
  // sera détruit. Deux gestes pour une suppression irréversible, sans
  // fenêtre de confirmation supplémentaire par-dessus la modale.
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async () => {
    if (deleting) return;

    setDeleting(true);
    setDeleteError("");

    try {
      await adminDeletePresenceQr(qr.id, { force: confirmDelete });

      onDeleted();
      onClose();
    } catch (caught) {
      // Refus parce que le service porte des présences : on ne le
      // présente pas comme une erreur mais comme la question qu'il
      // est, avec le compte exact renvoyé par le serveur.
      setDeleteError(caught?.message ?? "La suppression a échoué.");

      if (!confirmDelete && /présence/i.test(caught?.message ?? "")) {
        setConfirmDelete(true);
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleRevoke = async () => {
    if (revoking) return;

    setRevoking(true);

    try {
      await adminRevokePresenceQr(qr.id);
      setRevoked(true);
      onRevoked();
    } finally {
      setRevoking(false);
    }
  };

  const handleExport = async (format) => {
    if (exporting) return;

    setExporting(format);
    setExportError("");

    try {
      const { blob, filename } =
        format === "pdf"
          ? await downloadAttendancePdf(qr.id)
          : await downloadAttendanceXlsx(qr.id);

      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = url;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    } catch (caught) {
      setExportError(caught?.message ?? "L'export n'a pas pu être généré.");
    } finally {
      setExporting("");
    }
  };

  return (
    <AdminModal
      title={qr.label}
      description={describeWindow(qr)}
      onClose={onClose}
      wide
    >
      {/* Deux colonnes à partir de 900 px : à gauche ce qui SERT au
          service (le QR à imprimer) et ce qui le clôt (révocation,
          suppression) ; à droite ce qu'il PRODUIT (présences, historique
          des agents), c'est-à-dire les deux listes qui s'allongent. Sur
          un téléphone, les colonnes s'empilent et l'ordre reste celui
          du DOM, qui est déjà le bon. */}
      <div className="admin-presences__detail">
        <div className="admin-presences__detail-aside">
          <section className="admin-presences__detail-section">
            <h3>
              <QrCodeIcon
                size={16}
                aria-hidden="true"
              />
              QR à imprimer
            </h3>

            {imageLoading && <AdminLoading label="Génération de l'image…" />}

            {image && (
              <div className="admin-presences__qr-image">
                <img
                  src={image.dataUrl}
                  alt={`QR de sécurité — ${qr.label}`}
                />

                <a
                  href={image.dataUrl}
                  download={`qr-securite-${qr.id}.png`}
                >
                  <Download
                    size={15}
                    aria-hidden="true"
                  />
                  Télécharger
                </a>
            </div>
          )}
        </section>

        <button
          type="button"
          className="admin-presences__revoke"
          onClick={handleRevoke}
          disabled={revoking || revoked}
        >
          <Ban
            size={16}
            aria-hidden="true"
          />
          {revoked ? "QR révoqué" : revoking ? "Révocation…" : "Révoquer ce QR"}
        </button>

        {/* La révocation coupe l'accès mais garde la trace du service —
            c'est le bon geste pour un culte qui a eu lieu. La
            suppression, elle, fait disparaître la ligne ET sa feuille
            de présence : réservée aux QR créés par erreur ou aux essais,
            et refusée par le serveur tant que le QR est en cours. */}
        <button
          type="button"
          className="admin-presences__delete"
          onClick={handleDelete}
          disabled={deleting}
        >
          <Trash2
            size={16}
            aria-hidden="true"
          />
          {deleting
            ? "Suppression…"
            : confirmDelete
              ? "Confirmer la suppression définitive"
              : "Supprimer ce service"}
        </button>

        {deleteError && (
          <p className="admin-presences__delete-error" role="alert">
            <AlertCircle
              size={15}
              aria-hidden="true"
            />
            {deleteError}
          </p>
        )}
        </div>

        <div className="admin-presences__detail-main">
          <section className="admin-presences__detail-section">
            <div className="admin-presences__detail-heading">
              <h3>
                <Users
                  size={16}
                  aria-hidden="true"
                />
                Présences enregistrées ({counts?.total ?? attendance?.length ?? 0})
              </h3>

              <div className="admin-presences__export-group">
                <button
                  type="button"
                  className="admin-presences__export"
                  onClick={() => handleExport("xlsx")}
                  disabled={Boolean(exporting)}
                >
                  {exporting === "xlsx" ? (
                    <Loader2
                      className="admin-presences__spin"
                      size={14}
                      aria-hidden="true"
                    />
                  ) : (
                    <Download
                      size={14}
                      aria-hidden="true"
                    />
                  )}
                  {exporting === "xlsx" ? "Génération…" : "Excel (.xlsx)"}
                </button>

                <button
                  type="button"
                  className="admin-presences__export"
                  onClick={() => handleExport("pdf")}
                  disabled={Boolean(exporting)}
                >
                  {exporting === "pdf" ? (
                    <Loader2
                      className="admin-presences__spin"
                      size={14}
                      aria-hidden="true"
                    />
                  ) : (
                    <Download
                      size={14}
                      aria-hidden="true"
                    />
                  )}
                  {exporting === "pdf" ? "Génération…" : "PDF"}
                </button>
              </div>
            </div>

            {counts && (
              <p className="admin-presences__counts">
                {counts.members} membre{counts.members > 1 ? "s" : ""} · {counts.visitors} visiteur
                {counts.visitors > 1 ? "s" : ""}
              </p>
            )}

            {exportError && (
              <p
                className="admin-presences__form-error"
                role="alert"
              >
                <AlertCircle
                  size={16}
                  aria-hidden="true"
                />
                {exportError}
              </p>
            )}

            {attendanceLoading && <AdminLoading label="Chargement…" />}

            {!attendanceLoading && (attendance ?? []).length === 0 && (
              <p className="admin-presences__detail-empty">
                Aucune présence enregistrée pour l&apos;instant.
              </p>
            )}

            {!attendanceLoading && (attendance ?? []).length > 0 && (
              <ul className="admin-presences__detail-list">
                {attendance.map((record) => (
                  <li key={record.id}>
                    <span>
                      {record.kind === "visitor"
                        ? `${record.visitor?.firstName ?? ""} ${record.visitor?.lastName ?? ""}`.trim()
                        : `${record.member?.firstName ?? ""} ${record.member?.lastName ?? ""}`.trim()}
                    </span>
                    <span>
                      {record.kind === "visitor"
                        ? "Visiteur"
                        : record.member?.registrationNumber
                          ? formatRegistrationNumber(record.member.registrationNumber)
                          : "—"}
                    </span>
                    <span>
                      {new Date(record.recordedAt).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="admin-presences__detail-section">
            <h3>
              <History
                size={16}
                aria-hidden="true"
              />
              Historique de connexion des agents
            </h3>

            {historyLoading && <AdminLoading label="Chargement…" />}

            {!historyLoading && (history ?? []).length === 0 && (
              <p className="admin-presences__detail-empty">
                Aucun agent ne s&apos;est encore connecté avec ce QR.
              </p>
            )}

            {!historyLoading && (history ?? []).length > 0 && (
              <ul className="admin-presences__detail-list">
                {history.map((entry) => (
                  <li key={entry.id}>
                    <span>
                      {entry.agent?.firstName} {entry.agent?.lastName}
                    </span>
                    <span>{formatRegistrationNumber(entry.agent?.registrationNumber)}</span>
                    <span>{formatDateTime(entry.loggedInAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AdminModal>
  );
};

export default PresencesAdmin;
