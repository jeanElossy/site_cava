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
  paid: { label: "Encaissé", icon: Check },
  pending: { label: "En attente", icon: Clock },
  failed: { label: "Échoué", icon: X },
  suspect: { label: "À vérifier", icon: AlertTriangle },
};

const TYPE_LABELS = {
  dime: "Dîme",
  offrande: "Offrande",
  don: "Don",
  grace: "Action de grâce",
  projet: "Projet spécial",
};

// Les montants sont en francs CFA, sans décimales.
const money = (value) =>
  `${Number(value ?? 0).toLocaleString("fr-FR")} F`;

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

// Nom affiché. Un don anonyme n'a rien à afficher : le modèle n'a même
// pas enregistré d'identité, ce n'est pas qu'un masquage à l'écran.
const donorName = (donation) => {
  if (donation.donor?.anonymous) return "Anonyme";

  const full = [donation.donor?.firstName, donation.donor?.lastName]
    .filter(Boolean)
    .join(" ");

  return full || "—";
};

const DonationsAdmin = () => {
  usePageMeta({
    title: "Dons — Administration",
    description:
      "Suivi des contributions reçues par le Centre Apostolique Vie et Abondance.",
  });

  const [status, setStatus] = useState("");
  const [qrOpen, setQrOpen] = useState(false);

  const load = useCallback(
    () => adminDonations(status ? { status, limit: 100 } : { limit: 100 }),
    [status]
  );

  const { data, loading, error, reload } = useAsyncData(load);

  const summaryLoad = useCallback(() => adminDonationSummary(), []);

  const { data: summary } = useAsyncData(summaryLoad);

  const donations = data?.items ?? [];

  return (
    <div className="admin-donations">

      <header className="admin-donations__header">
        <div>
          <h1>Dons</h1>

          <p>
            Contributions reçues en ligne. Les montants encaissés sont
            confirmés auprès du prestataire de paiement.
          </p>
        </div>

        <div className="admin-donations__header-actions">
          <button
            type="button"
            className="admin-donations__qr-open"
            onClick={() => setQrOpen(true)}
          >
            <QrCode size={17} aria-hidden="true" />
            QR code de don
          </button>

          <button
            type="button"
            className="admin-donations__refresh"
            onClick={reload}
          >
            <RefreshCw size={17} aria-hidden="true" />
            Actualiser
          </button>
        </div>
      </header>

      {/* Le paiement n'est pas configuré : le dire ici, sinon la page
          reste vide sans qu'on comprenne pourquoi. */}
      {summary && summary.enabled === false && (
        <div className="admin-donations__warning" role="status">
          <AlertTriangle size={19} aria-hidden="true" />

          <p>
            Les dons en ligne ne sont pas activés : les clés CinetPay
            sont absentes de la configuration du serveur. Le tunnel de
            don affiche un message d'attente aux visiteurs.
          </p>
        </div>
      )}

      {summary && (
        <ul className="admin-donations__stats">
          <li className="admin-donations__stat admin-donations__stat--paid">
            <span className="admin-donations__stat-label">Encaissé ce mois</span>
            <strong>{money(summary.thisMonth?.total)}</strong>
            <span className="admin-donations__stat-hint">
              {summary.thisMonth?.count ?? 0} don(s)
            </span>
          </li>

          <li className="admin-donations__stat">
            <span className="admin-donations__stat-label">Total encaissé</span>
            <strong>{money(summary.paid?.total)}</strong>
            <span className="admin-donations__stat-hint">
              {summary.paid?.count ?? 0} don(s)
            </span>
          </li>

          <li className="admin-donations__stat">
            <span className="admin-donations__stat-label">En attente</span>
            <strong>{summary.pending?.count ?? 0}</strong>
            <span className="admin-donations__stat-hint">
              {summary.stale > 0
                ? `dont ${summary.stale} de plus de 24 h`
                : "guichets en cours"}
            </span>
          </li>

          {/* Mis en avant seulement s'il y en a : une case « 0 à
              vérifier » en permanence finit par ne plus être lue. */}
          {summary.suspect?.count > 0 && (
            <li className="admin-donations__stat admin-donations__stat--suspect">
              <span className="admin-donations__stat-label">À vérifier</span>
              <strong>{summary.suspect.count}</strong>
              <span className="admin-donations__stat-hint">
                écart de montant constaté
              </span>
            </li>
          )}
        </ul>
      )}

      <div className="admin-donations__filters" role="group" aria-label="Filtrer par statut">
        {[
          ["", "Tous"],
          ["paid", "Encaissés"],
          ["pending", "En attente"],
          ["suspect", "À vérifier"],
          ["failed", "Échoués"],
        ].map(([value, label]) => (
          <button
            key={value || "all"}
            type="button"
            className={
              status === value
                ? "admin-donations__filter admin-donations__filter--active"
                : "admin-donations__filter"
            }
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
          message={
            status
              ? "Aucun don ne correspond à ce filtre."
              : "Aucun don pour l'instant. Les contributions reçues via le site apparaîtront ici."
          }
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
                <th scope="col">Statut</th>
              </tr>
            </thead>

            <tbody>
              {donations.map((donation) => {
                const meta = STATUS[donation.status] ?? STATUS.pending;
                const Icon = meta.icon;

                return (
                  <tr key={donation.reference}>
                    <td>
                      <span className="admin-donations__date">
                        {formatDate(donation.createdAt)}
                      </span>

                      <span className="admin-donations__reference">
                        {donation.reference}
                      </span>
                    </td>

                    <td>{donorName(donation)}</td>

                    <td>
                      {TYPE_LABELS[donation.contributionType] ??
                        donation.contributionType}
                    </td>

                    <td className="admin-donations__method">
                      {donation.paidWith || donation.paymentMethod}
                    </td>

                    <td className="admin-donations__amount">
                      {money(donation.amount)}
                    </td>

                    <td>
                      <span
                        className={`admin-donations__status admin-donations__status--${donation.status}`}
                      >
                        <Icon size={13} aria-hidden="true" />
                        {meta.label}
                      </span>

                      {donation.failureReason && (
                        <span className="admin-donations__reason">
                          {donation.failureReason}
                        </span>
                      )}

                      {/* Permet de retrouver et renvoyer le reçu d'un
                          donateur qui l'aurait perdu. */}
                      {donation.status === "paid" && (
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {qrOpen && (
        <QrCodeModal onClose={() => setQrOpen(false)} />
      )}

    </div>
  );
};

// ------------------------------------------------------------------
// QR CODE À PROJETER
// ------------------------------------------------------------------
// Le code est généré par le serveur, pas ici : l'URL encodée est ainsi
// toujours construite à partir de l'adresse réelle du site. Un QR code
// affiché sur l'écran d'un culte et menant à une page morte ne se
// remarquerait qu'une fois trop tard.
const QrCodeModal = ({ onClose }) => {
  const [type, setType] = useState("don");
  const [amount, setAmount] = useState("");

  // Les valeurs SAISIES et les valeurs GÉNÉRÉES sont deux états
  // distincts.
  //
  // `useAsyncData` relance son chargement dès que la fonction passée
  // change d'identité. Faire dépendre celle-ci directement de `amount`
  // enverrait une requête à chaque frappe — soit huit appels réseau
  // pour taper « 10000 ». Le QR n'est donc régénéré que sur demande
  // explicite.
  const [params, setParams] = useState({ type: "don" });

  const load = useCallback(
    () => adminDonationQrCode(params),
    [params]
  );

  const { data, loading, error, reload } = useAsyncData(load);

  const generate = () => {
    const next = {
      ...(type ? { type } : {}),
      ...(amount ? { amount } : {}),
    };

    // Paramètres inchangés : l'identité de `load` ne bougerait pas et
    // rien ne se passerait. On force alors le rechargement.
    if (JSON.stringify(next) === JSON.stringify(params)) reload();
    else setParams(next);
  };

  return (
    <AdminModal
      title="QR code de don"
      description="À projeter pendant un direct ou un culte : en le scannant, le visiteur arrive directement sur la page de don, avec le type de contribution déjà sélectionné."
      onClose={onClose}
    >
      <div className="admin-donations__qr">

        <div className="admin-donations__qr-fields">
          <label>
            <span>Type de contribution</span>

            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              <option value="">Aucun (choix libre)</option>

              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Montant suggéré (facultatif)</span>

            <input
              type="number"
              min="200"
              step="500"
              value={amount}
              placeholder="Laisser vide pour un montant libre"
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
        </div>

        <button
          type="button"
          className="admin-donations__qr-generate"
          onClick={generate}
          disabled={loading}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {loading ? "Génération…" : "Générer le QR code"}
        </button>

        {error && <AdminError message={error} onRetry={reload} />}

        {data && (
          <div className="admin-donations__qr-result">
            <img src={data.dataUrl} alt="QR code menant à la page de don" />

            <p className="admin-donations__qr-url">{data.url}</p>

            <a
              className="admin-donations__qr-download"
              href={data.dataUrl}
              download="cava-qr-don.png"
            >
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
