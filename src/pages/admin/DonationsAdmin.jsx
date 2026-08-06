import { useCallback, useState } from "react";

import {
  AlertTriangle,
  Check,
  Clock,
  Download,
  FileText,
  QrCode,
  RefreshCw,
  X,
} from "lucide-react";

import {
  adminDonations,
  adminDonationQrCode,
  adminDonationSummary,
  reviewDonation,
} from "../../services/donations";

import { apiBaseUrl } from "../../services/http";

import useAsyncData from "../../hooks/useAsyncData";
import usePageMeta from "../../hooks/usePageMeta";

import AdminModal from "../../components/admin/AdminModal";

import {
  AdminEmpty,
  AdminError,
  AdminLoading,
} from "../../components/admin/AdminFeedback";

import "./DonationsAdmin.scss";

const STATUS = {
  valide: { label: "Validé", icon: Check },
  en_attente: { label: "En attente", icon: Clock },
  rejete: { label: "Rejeté", icon: X },
};

const money = (value) => `${Number(value ?? 0).toLocaleString("fr-FR")} F`;

const formatDate = (value) => {
  if (!value) return "—";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const donorName = (donation) =>
  [donation.donor?.firstName, donation.donor?.lastName].filter(Boolean).join(" ") || "—";

const DonationsAdmin = () => {
  usePageMeta({
    title: "Dons — Administration",
    description:
      "Suivi des contributions reçues par le Centre Apostolique Vie et Abondance.",
  });

  const [status, setStatus] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [reviewing, setReviewing] = useState(null);

  const load = useCallback(
    () => adminDonations(status ? { status, limit: 100 } : { limit: 100 }),
    [status]
  );

  const { data, loading, error, reload } = useAsyncData(load);

  const summaryLoad = useCallback(() => adminDonationSummary(), []);
  const { data: summary, reload: reloadSummary } = useAsyncData(summaryLoad);

  const donations = data?.items ?? [];

  const afterReview = () => {
    setReviewing(null);
    reload();
    reloadSummary();
  };

  return (
    <div className="admin-donations">

      <header className="admin-donations__header">
        <div>
          <h1>Dons</h1>
          <p>
            Contributions déclarées par Mobile Money. Chaque don reste « en attente » jusqu'à
            vérification manuelle du numéro de transaction contre le relevé de l'église.
          </p>
        </div>

        <div className="admin-donations__header-actions">
          <button type="button" className="admin-donations__qr-open" onClick={() => setQrOpen(true)}>
            <QrCode size={17} aria-hidden="true" />
            QR code de don
          </button>

          <button type="button" className="admin-donations__refresh" onClick={reload}>
            <RefreshCw size={17} aria-hidden="true" />
            Actualiser
          </button>
        </div>
      </header>

      {summary && (
        <ul className="admin-donations__stats">
          <li className="admin-donations__stat admin-donations__stat--paid">
            <span className="admin-donations__stat-label">Validé ce mois</span>
            <strong>{money(summary.thisMonth?.total)}</strong>
            <span className="admin-donations__stat-hint">{summary.thisMonth?.count ?? 0} don(s)</span>
          </li>

          <li className="admin-donations__stat">
            <span className="admin-donations__stat-label">Total validé</span>
            <strong>{money(summary.valide?.total)}</strong>
            <span className="admin-donations__stat-hint">{summary.valide?.count ?? 0} don(s)</span>
          </li>

          <li className="admin-donations__stat admin-donations__stat--suspect">
            <span className="admin-donations__stat-label">En attente</span>
            <strong>{summary.en_attente?.count ?? 0}</strong>
            <span className="admin-donations__stat-hint">à vérifier</span>
          </li>
        </ul>
      )}

      <div className="admin-donations__filters" role="group" aria-label="Filtrer par statut">
        {[
          ["", "Tous"],
          ["en_attente", "En attente"],
          ["valide", "Validés"],
          ["rejete", "Rejetés"],
        ].map(([value, label]) => (
          <button
            key={value || "all"}
            type="button"
            className={status === value ? "admin-donations__filter admin-donations__filter--active" : "admin-donations__filter"}
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <AdminLoading />}
      {error && <AdminError message={error} onRetry={reload} />}

      {!loading && !error && donations.length === 0 && (
        <AdminEmpty
          message={status ? "Aucun don ne correspond à ce filtre." : "Aucun don pour l'instant."}
        />
      )}

      {!loading && !error && donations.length > 0 && (
        <div className="admin-donations__table-wrap">
          <table className="admin-donations__table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Donateur</th>
                <th scope="col">Type</th>
                <th scope="col">Moyen</th>
                <th scope="col">Montant</th>
                <th scope="col">Preuve</th>
                <th scope="col">Statut</th>
                <th scope="col" className="admin-donations__actions-col">Actions</th>
              </tr>
            </thead>

            <tbody>
              {donations.map((donation) => {
                const meta = STATUS[donation.status] ?? STATUS.en_attente;
                const Icon = meta.icon;

                return (
                  <tr key={donation.id}>
                    <td>
                      <span className="admin-donations__date">{formatDate(donation.createdAt)}</span>
                      <span className="admin-donations__reference">{donation.reference}</span>
                    </td>

                    <td>{donorName(donation)}</td>
                    <td>{donation.donationType?.name ?? "—"}</td>
                    <td className="admin-donations__method">{donation.paymentMethod?.name ?? "—"}</td>
                    <td className="admin-donations__amount">{money(donation.amount)}</td>

                    <td>
                      <span className="admin-donations__transaction">{donation.proof?.transactionId}</span>

                      {donation.proof?.imageUrl && (
                        <a
                          href={donation.proof.imageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="admin-donations__proof-link"
                        >
                          Voir l'image
                        </a>
                      )}
                    </td>

                    <td>
                      <span className={`admin-donations__status admin-donations__status--${donation.status}`}>
                        <Icon size={13} aria-hidden="true" />
                        {meta.label}
                      </span>

                      {donation.adminNote && (
                        <span className="admin-donations__reason">{donation.adminNote}</span>
                      )}

                      {donation.status === "valide" && (
                        <a
                          className="admin-donations__receipt"
                          href={`${apiBaseUrl}/api/donations/${donation.reference}/recu`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <FileText size={12} aria-hidden="true" />
                          Reçu
                        </a>
                      )}
                    </td>

                    <td>
                      {donation.status === "en_attente" && (
                        <button
                          type="button"
                          className="admin-donations__review-open"
                          onClick={() => setReviewing(donation)}
                        >
                          Vérifier
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {qrOpen && <QrCodeModal onClose={() => setQrOpen(false)} />}

      {reviewing && (
        <ReviewModal donation={reviewing} onClose={() => setReviewing(null)} onDone={afterReview} />
      )}

    </div>
  );
};

// ------------------------------------------------------------------
// VALIDATION / REJET
// ------------------------------------------------------------------
const ReviewModal = ({ donation, onClose, onDone }) => {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const decide = async (decision) => {
    setBusy(decision);
    setError("");

    try {
      await reviewDonation(donation.id, decision, note);
      onDone();
    } catch (caught) {
      setError(caught.message ?? "La décision n'a pas pu être enregistrée.");
      setBusy("");
    }
  };

  return (
    <AdminModal
      title="Vérifier ce don"
      description="Comparez le numéro de transaction avec le relevé Mobile Money de l'église avant de décider."
      onClose={onClose}
    >
      <div className="admin-donations__review">
        <dl className="admin-donations__review-details">
          <div><dt>Donateur</dt><dd>{donorName(donation)}</dd></div>
          <div><dt>Téléphone</dt><dd>{donation.donor?.phone}</dd></div>
          <div><dt>Montant</dt><dd>{money(donation.amount)}</dd></div>
          <div><dt>Moyen</dt><dd>{donation.paymentMethod?.name}</dd></div>
          <div><dt>Transaction</dt><dd>{donation.proof?.transactionId}</dd></div>
        </dl>

        {donation.proof?.imageUrl && (
          <img
            src={donation.proof.imageUrl}
            alt="Preuve envoyée par le donateur"
            className="admin-donations__review-image"
          />
        )}

        <label className="admin-donations__review-note">
          <span>Remarque (obligatoire en cas de rejet)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Ex. : numéro introuvable sur le relevé du jour"
          />
        </label>

        {error && <p className="step-error" role="alert">{error}</p>}

        <div className="admin-donations__review-actions">
          <button type="button" onClick={() => decide("rejete")} disabled={busy !== ""}>
            {busy === "rejete" ? "Rejet en cours…" : "Rejeter"}
          </button>

          <button
            type="button"
            className="admin-donations__review-validate"
            onClick={() => decide("valide")}
            disabled={busy !== ""}
          >
            {busy === "valide" ? "Validation en cours…" : "Valider"}
          </button>
        </div>
      </div>
    </AdminModal>
  );
};

// ------------------------------------------------------------------
// QR CODE À PROJETER (inchangé dans son fonctionnement)
// ------------------------------------------------------------------
const QrCodeModal = ({ onClose }) => {
  const [type, setType] = useState("");
  const [amount, setAmount] = useState("");
  const [params, setParams] = useState({});

  const load = useCallback(() => adminDonationQrCode(params), [params]);
  const { data, loading, error, reload } = useAsyncData(load);

  const generate = () => {
    const next = { ...(type ? { type } : {}), ...(amount ? { amount } : {}) };

    if (JSON.stringify(next) === JSON.stringify(params)) reload();
    else setParams(next);
  };

  return (
    <AdminModal
      title="QR code de don"
      description="À projeter pendant un direct ou un culte : en le scannant, le visiteur arrive directement sur la page de don."
      onClose={onClose}
    >
      <div className="admin-donations__qr">
        <div className="admin-donations__qr-fields">
          <label>
            <span>Type de don (identifiant)</span>
            <input
              type="text"
              value={type}
              placeholder="Laisser vide pour un choix libre"
              onChange={(e) => setType(e.target.value)}
            />
          </label>

          <label>
            <span>Montant suggéré (facultatif)</span>
            <input
              type="number"
              min="200"
              step="500"
              value={amount}
              placeholder="Laisser vide pour un montant libre"
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
        </div>

        <button type="button" className="admin-donations__qr-generate" onClick={generate} disabled={loading}>
          <RefreshCw size={16} aria-hidden="true" />
          {loading ? "Génération…" : "Générer le QR code"}
        </button>

        {error && <AdminError message={error} onRetry={reload} />}

        {data?.warning && (
          <div className="admin-donations__qr-warning" role="alert">
            <AlertTriangle size={18} aria-hidden="true" />
            <p>{data.warning}</p>
          </div>
        )}

        {data && (
          <div className="admin-donations__qr-result">
            <img src={data.dataUrl} alt="QR code menant à la page de don" />
            <p className="admin-donations__qr-url">{data.url}</p>
            <a className="admin-donations__qr-download" href={data.dataUrl} download="cava-qr-don.png">
              <Download size={16} aria-hidden="true" />
              Télécharger l'image
            </a>
          </div>
        )}
      </div>
    </AdminModal>
  );
};

export default DonationsAdmin;
