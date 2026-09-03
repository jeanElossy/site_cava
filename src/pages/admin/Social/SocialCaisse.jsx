import { useCallback, useState } from "react";

import { CalendarRange, Lock, LockOpen, Settings } from "lucide-react";

import {
  closeSocialExercice,
  fetchSocialCaisse,
  fetchSocialExercices,
  fetchSocialLedger,
  fetchSocialSettings,
  openSocialExercice,
  reopenSocialExercice,
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
// enregistrer des offrandes mais pas à modifier le montant mensuel ni
// à clôturer un exercice). Voir la matrice de droits du document de
// conception.
const canConfigure = () => ["admin", "social_admin"].includes(currentUser()?.role);

const MOVEMENT_TYPE_LABELS = {
  cotisation: "Offrande",
  aide: "Aide sociale",
  aide_annulation: "Annulation d'aide",
};

const SocialCaisse = () => {
  usePageMeta({
    title: "Service Social — Caisse",
    description:
      "Solde et mouvements de la caisse sociale, par église et par exercice annuel.",
  });

  const { options: churchOptions, loading: churchesLoading } = useChurchOptions();

  // La caisse n'a pas de vue « toutes les églises » : un solde
  // appartient à une caisse physique, pas à une somme d'églises. Il
  // faut donc toujours une église sélectionnée. `church` démarre à
  // `null` le temps que la liste réelle des églises se charge, puis se
  // cale sur la première disponible — ajusté pendant le rendu plutôt
  // que dans un effet, pour ne jamais présélectionner une église
  // fictive.
  const [church, setChurch] = useState(null);
  const [year, setYear] = useState(null);
  const [page, setPage] = useState(1);
  const [configOpen, setConfigOpen] = useState(false);
  const [exercicesOpen, setExercicesOpen] = useState(false);

  if (church === null && churchOptions.length > 0) {
    setChurch(churchOptions[0].value);
  }

  const loadExercices = useCallback(() => {
    if (!church) return Promise.resolve(null);

    return fetchSocialExercices({ church });
  }, [church]);

  const {
    data: exercices,
    loading: exercicesLoading,
    reload: reloadExercices,
  } = useAsyncData(loadExercices);

  // L'exercice affiché par défaut est le plus récent (l'API les trie
  // décroissant), c'est-à-dire l'année en cours. Calé pendant le rendu,
  // comme l'église : un effet aurait affiché un instant la caisse d'une
  // mauvaise année.
  const [exercicesSnapshot, setExercicesSnapshot] = useState(null);

  if (exercices && exercices !== exercicesSnapshot) {
    setExercicesSnapshot(exercices);

    if (exercices.length > 0 && !exercices.some((item) => item.year === year)) {
      setYear(exercices[0].year);
      setPage(1);
    }
  }

  // Le changement d'église revient à la première page des mouvements et
  // relâche l'exercice sélectionné (les exercices d'une autre église
  // n'ont aucune raison de coïncider) — géré dans le gestionnaire
  // plutôt que dans un effet, pour éviter un rendu en cascade.
  const changeChurch = (value) => {
    setChurch(Number(value));
    setYear(null);
    setExercicesSnapshot(null);
    setPage(1);
  };

  const changeYear = (value) => {
    setYear(Number(value));
    setPage(1);
  };

  const loadCaisse = useCallback(() => {
    if (!church || !year) return Promise.resolve(null);

    return fetchSocialCaisse({ church, year });
  }, [church, year]);

  const {
    data: caisse,
    loading: caisseLoading,
    error: caisseError,
    reload: reloadCaisse,
  } = useAsyncData(loadCaisse);

  const loadLedger = useCallback(() => {
    if (!church || !year) return Promise.resolve(null);

    return fetchSocialLedger({ church, year, page, limit: 20 });
  }, [church, year, page]);

  const {
    data: ledger,
    loading: ledgerLoading,
    error: ledgerError,
    reload: reloadLedger,
  } = useAsyncData(loadLedger);

  const movements = ledger?.items ?? [];
  const meta = ledger?.meta ?? {};
  const pages =
    meta.pages ?? (meta.total && meta.perPage ? Math.ceil(meta.total / meta.perPage) : 1);

  const closed = caisse?.status === "cloture";

  const refreshAll = () => {
    reloadExercices();
    reloadCaisse();
    reloadLedger();
  };

  return (
    <div className="admin-social-caisse">
      <header className="admin-social-caisse__header">
        <div>
          <h1>Caisse sociale</h1>
          <p>
            Une caisse par église et par année. Elle est alimentée par les
            offrandes sociales, débitée par les aides versées, et son solde est
            reporté sur l&apos;exercice suivant à la clôture.
          </p>
        </div>

        <div className="admin-social-caisse__header-actions">
          <label className="admin-social-caisse__church-select">
            <span>Église</span>
            <select
              value={church ?? ""}
              onChange={(event) => changeChurch(event.target.value)}
            >
              {churchOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-social-caisse__church-select">
            <span>Exercice</span>
            <select
              value={year ?? ""}
              onChange={(event) => changeYear(event.target.value)}
              disabled={exercicesLoading || (exercices ?? []).length === 0}
            >
              {(exercices ?? []).map((item) => (
                <option key={item.year} value={item.year}>
                  {item.year}
                  {item.status === "cloture" ? " (clôturé)" : ""}
                </option>
              ))}
            </select>
          </label>

          {canConfigure() && (
            <>
              <button
                type="button"
                className="admin-social-caisse__configure"
                onClick={() => setExercicesOpen(true)}
              >
                <CalendarRange size={16} aria-hidden="true" />
                Exercices
              </button>

              <button
                type="button"
                className="admin-social-caisse__configure"
                onClick={() => setConfigOpen(true)}
              >
                <Settings size={16} aria-hidden="true" />
                Configurer
              </button>
            </>
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
        <>
          {closed && (
            <p className="admin-social-caisse__closed-note" role="status">
              <Lock size={15} aria-hidden="true" />
              Exercice {caisse.year} clôturé : plus aucun mouvement ne peut y
              être enregistré. Son solde a été reporté sur l&apos;exercice
              suivant.
            </p>
          )}

          <div className="admin-social-caisse__summary">
            <div className="admin-social-caisse__summary-line">
              <span>Report de l&apos;exercice précédent</span>
              <strong>{money(caisse.openingBalance)}</strong>
            </div>

            <div className="admin-social-caisse__summary-line">
              <span>Entrées {caisse.year}</span>
              <strong className="admin-social-caisse__in">
                +{money(caisse.totalIn)}
              </strong>
            </div>

            <div className="admin-social-caisse__summary-line">
              <span>Sorties {caisse.year}</span>
              <strong className="admin-social-caisse__out">
                −{money(caisse.totalOut)}
              </strong>
            </div>

            <div className="admin-social-caisse__summary-line admin-social-caisse__summary-line--current">
              <span>{closed ? "Solde de clôture" : "Solde actuel"}</span>
              <strong>{money(caisse.currentBalance)}</strong>
            </div>
          </div>
        </>
      )}

      {church !== null && year !== null && (
        <>
          <h2 className="admin-social-caisse__movements-title">
            Mouvements {year}
          </h2>

          {ledgerLoading && <AdminLoading />}
          {ledgerError && <AdminError message={ledgerError} onRetry={reloadLedger} />}

          {!ledgerLoading && !ledgerError && movements.length === 0 && (
            <AdminEmpty
              message={`Aucun mouvement enregistré sur l'exercice ${year}.`}
            />
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
                        {/* `data-label` : sous 760 px chaque ligne devient
                            une carte, cet intitulé remplaçant l'en-tête
                            de colonne (mixin `admin-stacked-table`). */}
                        <td data-label="Date">{formatDateOnly(movement.createdAt)}</td>
                        <td data-label="Heure">{formatTimeOnly(movement.createdAt)}</td>
                        <td className="admin-social-caisse__type" data-label="Type">
                          {MOVEMENT_TYPE_LABELS[movement.type] ?? movement.type}
                        </td>
                        <td data-label="Référence">{movement.reference ?? "—"}</td>
                        <td data-label="Description">{movement.description ?? "—"}</td>
                        <td
                          data-label="Montant"
                          className={
                            Number(movement.amount) < 0
                              ? "admin-social-caisse__amount admin-social-caisse__amount--out"
                              : "admin-social-caisse__amount"
                          }
                        >
                          {/* Une aide sociale décaissée journalise une
                              écriture négative (sortie) ; une offrande
                              ou une compensation d'annulation restent
                              positives. */}
                          {Number(movement.amount) < 0
                            ? `-${money(Math.abs(movement.amount))}`
                            : `+${money(movement.amount)}`}
                        </td>
                        <td data-label="Utilisateur">
                          {(movement.recordedBy &&
                          typeof movement.recordedBy === "object"
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
                    onClick={() =>
                      setPage((previous) => Math.min(previous + 1, pages))
                    }
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
          onDone={() => {
            setConfigOpen(false);
            reloadCaisse();
          }}
        />
      )}

      {exercicesOpen && (
        <ExercicesModal
          church={church}
          churchOptions={churchOptions}
          exercices={exercices ?? []}
          onClose={() => setExercicesOpen(false)}
          onChanged={refreshAll}
        />
      )}
    </div>
  );
};

// ------------------------------------------------------------------
// CONFIGURATION (montant mensuel)
// ------------------------------------------------------------------
// Le solde initial N'EST PLUS ici : il appartient au premier exercice
// de l'église (voir `ExercicesModal`). Deux endroits pour un même
// solde en donneraient deux versions concurrentes.
const ConfigModal = ({ church, churchOptions, onClose, onDone }) => {
  const loadSettings = useCallback(() => fetchSocialSettings(), []);
  const { data: settingsList, loading, error } = useAsyncData(loadSettings);

  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Initialise le champ éditable dès que les réglages arrivent, en
  // ajustant l'état pendant le rendu plutôt que dans un effet (voir
  // « Adjusting state based on a prop/async value » dans la doc React) :
  // `settingsSnapshot` retient la dernière liste déjà traitée.
  const [settingsSnapshot, setSettingsSnapshot] = useState(null);

  if (settingsList && settingsList !== settingsSnapshot) {
    const current = settingsList.find(
      (entry) => Number(entry.church) === Number(church)
    );

    setSettingsSnapshot(settingsList);
    setAmount(String(current?.monthlyContributionAmount ?? 1000));
  }

  const submit = async () => {
    setBusy(true);
    setSubmitError("");

    try {
      await updateSocialSettings(church, {
        monthlyContributionAmount: Number(amount),
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
      description="Montant de l'offrande sociale mensuelle attendue de chaque membre."
      onClose={onClose}
    >
      <div className="admin-social-caisse__config">
        {loading && <AdminLoading label="Chargement des réglages…" />}
        {error && <AdminError message={error} />}

        {!loading && !error && (
          <>
            <label>
              <span>Montant d&apos;offrande mensuel (F)</span>
              <input
                type="number"
                min="0"
                step="100"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>

            <p className="admin-social-caisse__config-hint">
              Ce montant s&apos;applique aux mois générés à partir de
              maintenant. Les mois déjà émis gardent le montant en vigueur à
              leur époque.
            </p>

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

// ------------------------------------------------------------------
// EXERCICES : ouverture, clôture, report
// ------------------------------------------------------------------
const ExercicesModal = ({
  church,
  churchOptions,
  exercices,
  onClose,
  onChanged,
}) => {
  const [busyYear, setBusyYear] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");

  // Un exercice « existe » dès qu'il a un document. La liste peut aussi
  // contenir une année seulement calculée (aucun exercice encore
  // ouvert) : c'est celle-là qu'il faut proposer d'ouvrir, avec la
  // reprise de trésorerie d'avant-système.
  const firstUnopened = exercices.find((item) => !item.exists);

  const run = async (year, action, successMessage) => {
    setBusyYear(year);
    setError("");
    setNotice("");

    try {
      await action();

      setNotice(successMessage);
      onChanged();
    } catch (caught) {
      setError(caught.message ?? "L'opération a échoué.");
    } finally {
      setBusyYear(null);
    }
  };

  return (
    <AdminModal
      title={`Exercices — ${churchLabelFrom(churchOptions, church)}`}
      description="Chaque année a sa propre caisse. Clôturer un exercice fige son solde et le reporte sur l'exercice suivant, créé automatiquement."
      onClose={onClose}
    >
      <div className="admin-social-caisse__exercices">
        {error && (
          <p role="alert" className="admin-social-caisse__config-error">
            {error}
          </p>
        )}

        {notice && (
          <p role="status" className="admin-social-caisse__config-notice">
            {notice}
          </p>
        )}

        {firstUnopened && (
          <div className="admin-social-caisse__open-first">
            <p>
              Aucun exercice n&apos;est encore ouvert pour cette église.
              Indiquez la trésorerie déjà en caisse avant la mise en service —
              c&apos;est la seule fois où ce solde se saisit à la main, ensuite
              il est toujours reporté.
            </p>

            <label>
              <span>Solde de départ (F)</span>
              <input
                type="number"
                min="0"
                step="100"
                value={openingBalance}
                onChange={(event) => setOpeningBalance(event.target.value)}
              />
            </label>

            <button
              type="button"
              className="admin-social-caisse__config-submit"
              disabled={busyYear !== null}
              onClick={() =>
                run(
                  firstUnopened.year,
                  () =>
                    openSocialExercice({
                      church,
                      year: firstUnopened.year,
                      openingBalance: Number(openingBalance),
                    }),
                  `Exercice ${firstUnopened.year} ouvert.`
                )
              }
            >
              {busyYear === firstUnopened.year
                ? "Ouverture…"
                : `Ouvrir l'exercice ${firstUnopened.year}`}
            </button>
          </div>
        )}

        <div className="admin-social-caisse__table-wrap">
          <table className="admin-social-caisse__table">
            <thead>
              <tr>
                <th scope="col">Exercice</th>
                <th scope="col">Report</th>
                <th scope="col">Entrées</th>
                <th scope="col">Sorties</th>
                <th scope="col">Solde</th>
                <th scope="col">État</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {exercices.map((item) => (
                <tr key={item.year}>
                  <td data-label="Exercice">
                    <strong>{item.year}</strong>
                  </td>
                  <td data-label="Report">{money(item.openingBalance)}</td>
                  <td className="admin-social-caisse__in" data-label="Entrées">
                    +{money(item.totalIn)}
                  </td>
                  <td className="admin-social-caisse__out" data-label="Sorties">
                    −{money(item.totalOut)}
                  </td>
                  <td data-label="Solde">
                    <strong>{money(item.currentBalance)}</strong>
                  </td>
                  <td data-label="État">
                    {item.status === "cloture" ? "Clôturé" : "Ouvert"}
                    {!item.exists && " (pas encore ouvert)"}
                  </td>
                  <td>
                    {item.exists && item.status === "ouvert" && (
                      <button
                        type="button"
                        className="admin-social-caisse__row-action"
                        disabled={busyYear !== null}
                        onClick={() =>
                          run(
                            item.year,
                            () => closeSocialExercice(church, item.year),
                            `Exercice ${item.year} clôturé, solde reporté sur ${
                              item.year + 1
                            }.`
                          )
                        }
                      >
                        <Lock size={14} aria-hidden="true" />
                        Clôturer
                      </button>
                    )}

                    {item.exists && item.status === "cloture" && (
                      <button
                        type="button"
                        className="admin-social-caisse__row-action"
                        disabled={busyYear !== null}
                        onClick={() =>
                          run(
                            item.year,
                            () => reopenSocialExercice(church, item.year),
                            `Exercice ${item.year} rouvert.`
                          )
                        }
                      >
                        <LockOpen size={14} aria-hidden="true" />
                        Rouvrir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminModal>
  );
};

export default SocialCaisse;
