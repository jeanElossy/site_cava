import { useCallback, useMemo, useState } from "react";

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
  Users,
} from "lucide-react";

import { events } from "../../services/api";
import {
  adminGeneratePresenceQr,
  adminListAttendance,
  adminPresenceQrHistory,
  adminPresenceQrImage,
  adminListPresenceQrs,
  adminRevokePresenceQr,
} from "../../services/presences";

import useAsyncData from "../../hooks/useAsyncData";
import usePageMeta from "../../hooks/usePageMeta";

import AdminModal from "../../components/admin/AdminModal";
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
} from "../../components/admin/AdminFeedback";

import "./PresencesAdmin.scss";

const STATUS_LABELS = {
  upcoming: "À venir",
  active: "Actif",
  expired: "Expiré",
  revoked: "Révoqué",
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
  const { data, loading, error, reload } = useAsyncData(load);

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

          <button
            type="button"
            className="admin-presences__refresh"
            onClick={reload}
          >
            <RefreshCw size={17} aria-hidden="true" />
            Actualiser
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
                {formatDateTime(qr.validFrom)} → {formatDateTime(qr.validUntil)}
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

  const now = useMemo(() => new Date(), []);
  const defaultUntil = useMemo(
    () => new Date(now.getTime() + 4 * 60 * 60 * 1000),
    [now]
  );

  const [label, setLabel] = useState("");
  const [eventId, setEventId] = useState("");
  const [validFrom, setValidFrom] = useState(toLocalInputValue(now));
  const [validUntil, setValidUntil] = useState(toLocalInputValue(defaultUntil));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Choisir un événement pré-remplit le libellé et, s'ils existent, les
  // horaires — un simple confort, jamais un lien obligatoire (voir la
  // spec : la fenêtre de badgeage diffère souvent de l'horaire affiché
  // de l'événement, ex. accueil dès 07h30 pour un culte à 08h30).
  const handleEventChange = (id) => {
    setEventId(id);

    const found = eventList?.find((item) => item.id === id);
    if (!found) return;

    setLabel(found.title);

    if (found.startAt) {
      setValidFrom(toLocalInputValue(new Date(found.startAt)));
    }
    if (found.endAt) {
      setValidUntil(toLocalInputValue(new Date(found.endAt)));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (busy) return;

    setBusy(true);
    setError("");

    try {
      await adminGeneratePresenceQr({
        label,
        event: eventId || undefined,
        validFrom: new Date(validFrom).toISOString(),
        validUntil: new Date(validUntil).toISOString(),
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
            <span>Début de validité</span>

            <input
              type="datetime-local"
              value={validFrom}
              onChange={(event) => setValidFrom(event.target.value)}
              required
              disabled={busy}
            />
          </label>

          <label>
            <span>Fin de validité</span>

            <input
              type="datetime-local"
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
              required
              disabled={busy}
            />
          </label>
        </div>

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
const QrDetailModal = ({ qr, onClose, onRevoked }) => {
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

  const [revoking, setRevoking] = useState(false);
  const [revoked, setRevoked] = useState(qr.status === "revoked");

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

  return (
    <AdminModal
      title={qr.label}
      description={`${formatDateTime(qr.validFrom)} → ${formatDateTime(qr.validUntil)}`}
      onClose={onClose}
    >
      <div className="admin-presences__detail">
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

        <section className="admin-presences__detail-section">
          <h3>
            <Users
              size={16}
              aria-hidden="true"
            />
            Présences enregistrées ({attendance?.length ?? 0})
          </h3>

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
                    {record.member?.firstName} {record.member?.lastName}
                  </span>
                  <span>{record.member?.registrationNumber}</span>
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
                  <span>{entry.agent?.registrationNumber}</span>
                  <span>{formatDateTime(entry.loggedInAt)}</span>
                </li>
              ))}
            </ul>
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
      </div>
    </AdminModal>
  );
};

export default PresencesAdmin;
