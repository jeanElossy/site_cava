import { useCallback, useState } from "react";

import { Settings } from "lucide-react";

import {
  fetchSocialCaisse,
  fetchSocialLedger,
  fetchSocialSettings,
  updateSocialSettings,
} from "../../../services/social";

import { currentUser } from "../../../services/auth";

import useAsyncData from "../../../hooks/useAsyncData";
import usePageMeta from "../../../hooks/usePageMeta";

import AdminModal from "../../../components/admin/AdminModal";

import {
  AdminEmpty,
  AdminError,
  AdminLoading,
} from "../../../components/admin/AdminFeedback";

import {
  churchLabelFrom,
  formatDateOnly,
  formatTimeOnly,
  money,
  useChurchOptions,
} from "./socialShared";

import "./SocialCaisse.scss";

// Réservé à social_admin/admin — un sous-ensemble plus strict que
// SOCIAL_WRITE_ROLES (qui inclut aussi social_agent, autorisé à
// enregistrer des cotisations mais pas à modifier le montant ou le
// solde initial de la caisse). Voir la matrice de droits du document
// de conception.
const canConfigure = () => ["admin", "social_admin"].includes(currentUser()?.role);

const SocialCaisse = () => {
  usePageMeta({
    title: "Service Social — Caisse",
    description:
      "Solde et mouvements de la caisse sociale, par église (cotisations uniquement en Phase 1).",
  });

  const { options: churchOptions, loading: churchesLoading } = useChurchOptions();

  // La caisse n'a pas de vue « toutes les églises » (un solde par
  // église, pas d'agrégat) — il faut donc toujours une église
  // sélectionnée. `church` démarre à `null` le temps que la liste
  // réelle des églises se charge, puis se cale sur la première
  // disponible — ajusté pendant le rendu plutôt que dans un effet
  // (même pattern que `settingsSnapshot` dans `ConfigModal`
  // ci-dessous), pour ne jamais présélectionner une église fictive.
  const [church, setChurch] = useState(null);
  const [page, setPage] = useState(1);
  const [configOpen, setConfigOpen] = useState(false);

  if (church === null && churchOptions.length > 0) {
    setChurch(churchOptions[0].value);
  }

  // Le changement d'église revient à la première page des mouvements
  // — géré directement dans le gestionnaire de changement plutôt que
  // dans un effet séparé (voir `changeChurch` ci-dessous), pour éviter
  // un rendu en cascade.
  const changeChurch = (value) => {
    setChurch(Number(value));
    setPage(1);
  };

  const loadCaisse = useCallback(() => {
    if (!church) return Promise.resolve(null);

    return fetchSocialCaisse({ church });
  }, [church]);

  const { data: caisse, loading: caisseLoading, error: caisseError, reload: reloadCaisse } =
    useAsyncData(loadCaisse);

  const loadLedger = useCallback(() => {
    if (!church) return Promise.resolve(null);

    return fetchSocialLedger({ church, page, limit: 20 });
  }, [church, page]);

  const { data: ledger, loading: ledgerLoading, error: ledgerError, reload: reloadLedger } =
    useAsyncData(loadLedger);

  const movements = ledger?.items ?? [];
  const meta = ledger?.meta ?? {};
  const pages = meta.pages ?? (meta.total && meta.limit ? Math.ceil(meta.total / meta.limit) : 1);

  const afterConfig = () => {
    setConfigOpen(false);
    reloadCaisse();
  };

  return (
    <div className="admin-social-caisse">
      <header className="admin-social-caisse__header">
        <div>
          <h1>Caisse sociale</h1>
          <p>
            Solde par église, alimenté uniquement par les cotisations en Phase 1
            (aucune sortie de caisse pour l&apos;instant).
          </p>
        </div>

        <div className="admin-social-caisse__header-actions">
          <label className="admin-social-caisse__church-select">
            <span>Église</span>
            <select value={church ?? ""} onChange={(event) => changeChurch(event.target.value)}>
              {churchOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {canConfigure() && (
            <button
              type="button"
              className="admin-social-caisse__configure"
              onClick={() => setConfigOpen(true)}
            >
              <Settings size={16} aria-hidden="true" />
              Configurer
            </button>
          )}
        </div>
      </header>

      {(churchesLoading || church === null) && !caisseError && (
        <AdminLoading label="Chargement des églises…" />
      )}

      {!churchesLoading && church !== null && churchOptions.length === 0 && (
        <AdminEmpty message="Aucune église n'est encore enregistrée (voir Communauté → Églises)." />
      )}

      {church !== null && caisseLoading && <AdminLoading />}
      {caisseError && <AdminError message={caisseError} onRetry={reloadCaisse} />}

      {church !== null && !caisseLoading && !caisseError && !caisse && (
        <AdminEmpty message="Cette église n'a pas encore de module Service Social actif." />
      )}

      {church !== null && !caisseLoading && !caisseError && caisse && (
        <div className="admin-social-caisse__summary">
          <div className="admin-social-caisse__summary-line">
            <span>Solde initial</span>
            <strong>{money(caisse.openingBalance)}</strong>
          </div>

          <div className="admin-social-caisse__summary-line">
            <span>Total des cotisations</span>
            <strong>{money(caisse.totalCotisations)}</strong>
          </div>

          <div className="admin-social-caisse__summary-line admin-social-caisse__summary-line--current">
            <span>Solde actuel</span>
            <strong>{money(caisse.currentBalance)}</strong>
          </div>
        </div>
      )}

      {church !== null && (
        <>
          <h2 className="admin-social-caisse__movements-title">Mouvements</h2>

          {ledgerLoading && <AdminLoading />}
          {ledgerError && <AdminError message={ledgerError} onRetry={reloadLedger} />}

          {!ledgerLoading && !ledgerError && movements.length === 0 && (
            <AdminEmpty message="Aucun mouvement enregistré pour cette église." />
          )}

      {!ledgerLoading && !ledgerError && movements.length > 0 && (
        <>
          <div className="admin-social-caisse__table-wrap">
            <table className="admin-social-caisse__table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Heure</th>
                  <th scope="col">Type</th>
                  <th scope="col">Référence</th>
                  <th scope="col">Description</th>
                  <th scope="col">Montant</th>
                  <th scope="col">Utilisateur</th>
                </tr>
              </thead>

              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td>{formatDateOnly(movement.createdAt)}</td>
                    <td>{formatTimeOnly(movement.createdAt)}</td>
                    <td className="admin-social-caisse__type">{movement.type}</td>
                    <td>{movement.reference ?? "—"}</td>
                    <td>{movement.description ?? "—"}</td>
                    <td
                      className={
                        Number(movement.amount) < 0
                          ? "admin-social-caisse__amount admin-social-caisse__amount--out"
                          : "admin-social-caisse__amount"
                      }
                    >
                      {/* Depuis la Phase 2, une aide sociale décaissée
                          journalise une écriture négative (sortie) —
                          voir SocialLedgerEntry, `amount` désormais
                          signé. Une cotisation ou une compensation
                          d'annulation restent positives. */}
                      {Number(movement.amount) < 0
                        ? `-${money(Math.abs(movement.amount))}`
                        : `+${money(movement.amount)}`}
                    </td>
                    <td>
                      {(movement.recordedBy && typeof movement.recordedBy === "object"
                        ? movement.recordedBy.name
                        : movement.recordedBy) || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="admin-social-caisse__pagination">
              <button
                type="button"
                onClick={() => setPage((previous) => Math.max(previous - 1, 1))}
                disabled={page <= 1}
              >
                Précédent
              </button>

              <span>
                Page {page} / {pages}
              </span>

              <button
                type="button"
                onClick={() => setPage((previous) => Math.min(previous + 1, pages))}
                disabled={page >= pages}
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}
        </>
      )}

      {configOpen && (
        <ConfigModal
          church={church}
          churchOptions={churchOptions}
          onClose={() => setConfigOpen(false)}
          onDone={afterConfig}
        />
      )}
    </div>
  );
};

// ------------------------------------------------------------------
// CONFIGURATION (montant mensuel + solde initial)
// ------------------------------------------------------------------
const ConfigModal = ({ church, churchOptions, onClose, onDone }) => {
  const loadSettings = useCallback(() => fetchSocialSettings(), []);
  const { data: settingsList, loading, error } = useAsyncData(loadSettings);

  const [amount, setAmount] = useState("");
  const [opening, setOpening] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Initialise les champs éditables dès que les réglages arrivent, en
  // ajustant l'état pendant le rendu plutôt que dans un effet (voir
  // « Adjusting state based on a prop/async value » dans la doc React) :
  // `settingsSnapshot` retient la dernière liste déjà traitée, et le
  // bloc ci-dessous ne s'exécute qu'une fois par nouvelle réponse.
  const [settingsSnapshot, setSettingsSnapshot] = useState(null);

  if (settingsList && settingsList !== settingsSnapshot) {
    const current = settingsList.find((entry) => Number(entry.church) === Number(church));

    setSettingsSnapshot(settingsList);
    setAmount(String(current?.monthlyContributionAmount ?? 1000));
    setOpening(String(current?.openingBalance ?? 0));
  }

  const submit = async () => {
    setBusy(true);
    setSubmitError("");

    try {
      await updateSocialSettings(church, {
        monthlyContributionAmount: Number(amount),
        openingBalance: Number(opening),
      });

      onDone();
    } catch (caught) {
      setSubmitError(caught.message ?? "L'enregistrement a échoué.");
      setBusy(false);
    }
  };

  return (
    <AdminModal
      title={`Configurer — ${churchLabelFrom(churchOptions, church)}`}
      description="Montant de cotisation mensuel et solde initial de caisse pour cette église."
      onClose={onClose}
    >
      <div className="admin-social-caisse__config">
        {loading && <AdminLoading label="Chargement des réglages…" />}
        {error && <AdminError message={error} />}

        {!loading && !error && (
          <>
            <label>
              <span>Montant de cotisation mensuel (F)</span>
              <input
                type="number"
                min="0"
                step="100"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>

            <label>
              <span>Solde initial de caisse (F)</span>
              <input
                type="number"
                min="0"
                step="100"
                value={opening}
                onChange={(event) => setOpening(event.target.value)}
              />
            </label>

            {submitError && (
              <p role="alert" className="admin-social-caisse__config-error">
                {submitError}
              </p>
            )}

            <button
              type="button"
              className="admin-social-caisse__config-submit"
              onClick={submit}
              disabled={busy}
            >
              {busy ? "Enregistrement…" : "Enregistrer"}
            </button>
          </>
        )}
      </div>
    </AdminModal>
  );
};

export default SocialCaisse;
