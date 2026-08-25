import { useCallback, useEffect, useRef, useState } from "react";

import { Check, PlusCircle, Search, X } from "lucide-react";

import {
  fetchMemberSocialFile,
  recordMemberArrears,
  searchSocialMembers,
} from "../../../services/social";

import { currentUser } from "../../../services/auth";

import useAsyncData from "../../../hooks/useAsyncData";
import usePageMeta from "../../../hooks/usePageMeta";

import {
  AdminEmpty,
  AdminError,
  AdminLoading,
} from "../../../components/admin/AdminFeedback";

import {
  LEGACY_YEARS,
  MONTH_OPTIONS,
  SOCIAL_START_YEAR,
  STATUS,
  churchLabelFrom,
  formatDateTime,
  memberMatricule,
  money,
  monthLabel,
  useChurchOptions,
} from "./socialShared";

import "./SocialMemberSearch.scss";

const SEARCH_DELAY_MS = 400;

// Ouvrir un arriéré, c'est CRÉER UNE DETTE — geste plus lourd qu'un
// encaissement. Réservé aux mêmes rôles que côté serveur
// (SOCIAL_ADMIN_ROLES) : l'agent de terrain enregistre des paiements,
// il ne décide pas de ce qui est dû.
const canRecordArrears = () =>
  ["admin", "social_admin"].includes(currentUser()?.role);

const SocialMemberSearch = () => {
  usePageMeta({
    title: "Service Social — Recherche membre",
    description:
      "Rechercher un membre et consulter son historique complet d'offrandes sociales.",
  });

  const { options: churchOptions } = useChurchOptions();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [selectedSummary, setSelectedSummary] = useState(null);

  const timerRef = useRef(null);

  useEffect(() => {
    // Pas de setState synchrone ici (voir react-hooks/set-state-in-effect) :
    // `resultsToShow` ci-dessous masque `results` tant que le champ
    // est vide, sans avoir besoin de le vider explicitement.
    if (!query.trim()) return undefined;

    clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchError("");

      try {
        const found = await searchSocialMembers({ q: query.trim() });

        setResults(found ?? []);
      } catch (caught) {
        setSearchError(caught.message ?? "La recherche a échoué.");
      } finally {
        setSearching(false);
      }
    }, SEARCH_DELAY_MS);

    return () => clearTimeout(timerRef.current);
  }, [query]);

  const resultsToShow = query.trim() ? results : [];

  const load = useCallback(() => {
    if (!selectedId) return Promise.resolve(null);

    return fetchMemberSocialFile(selectedId);
  }, [selectedId]);

  const { data: file, loading: fileLoading, error: fileError, reload: reloadFile } =
    useAsyncData(load);

  // ---- Saisie des arriérés antérieurs ----------------------------

  const [arrearsYear, setArrearsYear] = useState(LEGACY_YEARS[0] ?? "");
  const [arrearsMonths, setArrearsMonths] = useState([]);
  const [arrearsAmount, setArrearsAmount] = useState("");
  const [savingArrears, setSavingArrears] = useState(false);
  const [arrearsMessage, setArrearsMessage] = useState("");
  const [arrearsError, setArrearsError] = useState("");

  const resetArrearsForm = () => {
    setArrearsMonths([]);
    setArrearsAmount("");
    setArrearsMessage("");
    setArrearsError("");
  };

  const selectMember = (found) => {
    setSelectedId(found.id);
    setSelectedSummary(found);
    setResults([]);
    setQuery("");
    resetArrearsForm();
  };

  // Mois déjà ouverts pour l'année choisie : ils se cochent tout seuls
  // et ne se décochent pas. Les proposer à nouveau ferait croire à une
  // saisie possible alors que le serveur les ignorerait (idempotence).
  const openedMonths = new Set(
    (file?.contributions ?? [])
      .filter((line) => Number(line.year) === Number(arrearsYear))
      .map((line) => Number(line.month))
  );

  const toggleArrearsMonth = (month) => {
    setArrearsMessage("");
    setArrearsError("");

    setArrearsMonths((previous) =>
      previous.includes(month)
        ? previous.filter((value) => value !== month)
        : [...previous, month]
    );
  };

  const submitArrears = async (event) => {
    event.preventDefault();

    if (arrearsMonths.length === 0 || savingArrears) return;

    setSavingArrears(true);
    setArrearsMessage("");
    setArrearsError("");

    try {
      const result = await recordMemberArrears(selectedId, {
        year: Number(arrearsYear),
        months: arrearsMonths,
        // Champ laissé vide = montant mensuel courant de l'église,
        // décidé par le serveur : le frontend ne connaît pas le tarif
        // et n'a pas à en inventer un.
        ...(arrearsAmount.trim() ? { amountDue: Number(arrearsAmount) } : {}),
      });

      setArrearsMessage(
        result?.created > 0
          ? `${result.created} mois d'arriéré ${result.year} enregistré(s) — ${money(
              result.totalDue
            )} à recouvrer.`
          : `Aucun mois ajouté : ces mois de ${result?.year ?? arrearsYear} étaient déjà ouverts.`
      );

      setArrearsMonths([]);
      setArrearsAmount("");

      await reloadFile();
    } catch (caught) {
      setArrearsError(caught.message ?? "L'enregistrement a échoué.");
    } finally {
      setSavingArrears(false);
    }
  };

  return (
    <div className="admin-social-members">
      <header className="admin-social-members__header">
        <h1>Recherche membre — Service Social</h1>
        <p>
          Retrouvez un membre par matricule, nom, prénom ou téléphone pour
          consulter sa fiche sociale complète.
        </p>
      </header>

      <div className="admin-social-members__search">
        <div className="admin-social-members__search-field">
          <Search size={16} aria-hidden="true" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Matricule, nom, prénom ou téléphone"
          />
        </div>

        {searching && <p className="admin-social-members__hint">Recherche…</p>}

        {searchError && (
          <p role="alert" className="admin-social-members__error-text">
            {searchError}
          </p>
        )}

        {!searching && !searchError && query.trim() && resultsToShow.length === 0 && (
          <p className="admin-social-members__hint">Aucun membre trouvé.</p>
        )}

        {resultsToShow.length > 0 && (
          <ul className="admin-social-members__results">
            {resultsToShow.map((found) => (
              <li key={found.id}>
                <button type="button" onClick={() => selectMember(found)}>
                  <strong>{memberMatricule(found)}</strong>
                  <span>
                    {found.firstName} {found.lastName}
                  </span>
                  <span className="admin-social-members__results-church">
                    {churchLabelFrom(churchOptions, found.church)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedId && (
        <div className="admin-social-members__file">
          {fileLoading && <AdminLoading label="Chargement de la fiche…" />}
          {fileError && <AdminError message={fileError} onRetry={reloadFile} />}

          {!fileLoading && !fileError && !file && (
            <AdminEmpty message="Cette fiche n'a pas pu être retrouvée." />
          )}

          {!fileLoading && !fileError && file && (
            <>
              <div className="admin-social-members__identity">
                <div>
                  <strong>
                    {file.member?.firstName ?? selectedSummary?.firstName}{" "}
                    {file.member?.lastName ?? selectedSummary?.lastName}
                  </strong>
                  <span>{memberMatricule(file.member ?? selectedSummary)}</span>
                </div>

                <dl>
                  <div>
                    <dt>Église</dt>
                    <dd>{churchLabelFrom(churchOptions, file.member?.church)}</dd>
                  </div>
                  <div>
                    <dt>Bergerie</dt>
                    <dd>
                      {(file.member?.flock && typeof file.member.flock === "object"
                        ? file.member.flock.name
                        : file.member?.flock) || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Téléphone</dt>
                    <dd>{file.member?.phone ?? "—"}</dd>
                  </div>
                </dl>
              </div>

              <ul className="admin-social-members__totals">
                <li>
                  <span>Total cotisé</span>
                  <strong>{money(file.totals?.totalPaid)}</strong>
                </li>
                <li>
                  <span>Mois payés</span>
                  <strong>{file.totals?.paidMonths ?? 0}</strong>
                </li>
                <li>
                  <span>Mois impayés</span>
                  <strong>{file.totals?.unpaidMonths ?? 0}</strong>
                </li>
                <li>
                  <span>Dernière offrande</span>
                  <strong>{formatDateTime(file.totals?.lastPaymentAt)}</strong>
                </li>
              </ul>

              {canRecordArrears() && LEGACY_YEARS.length > 0 && (
                <section className="admin-social-members__arrears">
                  <h2>Arriérés antérieurs</h2>

                  <p className="admin-social-members__arrears-hint">
                    Les mois antérieurs à {SOCIAL_START_YEAR} ne sont pas
                    réclamés automatiquement : avant cette date, les offrandes
                    étaient tenues sur papier. Cochez ici les seuls mois restés
                    impayés pour ce membre. Réglés aujourd'hui, ils
                    alimenteront la caisse de l'exercice en cours.
                  </p>

                  <form
                    className="admin-social-members__arrears-form"
                    onSubmit={submitArrears}
                  >
                    <div className="admin-social-members__arrears-row">
                      <label>
                        <span>Année</span>
                        <select
                          value={arrearsYear}
                          onChange={(event) => {
                            setArrearsYear(event.target.value);
                            resetArrearsForm();
                          }}
                        >
                          {LEGACY_YEARS.map((year) => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span>Montant mensuel</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={arrearsAmount}
                          onChange={(event) =>
                            setArrearsAmount(event.target.value)
                          }
                          placeholder="Montant courant de l'église"
                        />
                      </label>
                    </div>

                    <fieldset className="admin-social-members__arrears-months">
                      <legend>Mois restés impayés</legend>

                      {MONTH_OPTIONS.map((option) => {
                        const alreadyOpen = openedMonths.has(option.value);
                        const checked =
                          alreadyOpen || arrearsMonths.includes(option.value);

                        return (
                          <label
                            key={option.value}
                            className={`admin-social-members__arrears-month${
                              alreadyOpen
                                ? " admin-social-members__arrears-month--locked"
                                : ""
                            }`}
                            title={
                              alreadyOpen
                                ? `${option.label} ${arrearsYear} est déjà ouvert pour ce membre.`
                                : undefined
                            }
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={alreadyOpen || savingArrears}
                              onChange={() => toggleArrearsMonth(option.value)}
                            />
                            <span>{option.label.slice(0, 3)}</span>
                          </label>
                        );
                      })}
                    </fieldset>

                    <button
                      type="submit"
                      className="admin-social-members__arrears-submit"
                      disabled={arrearsMonths.length === 0 || savingArrears}
                    >
                      <PlusCircle size={16} aria-hidden="true" />
                      {savingArrears
                        ? "Enregistrement…"
                        : `Ouvrir ${arrearsMonths.length || ""} mois d'arriéré`.trim()}
                    </button>
                  </form>

                  {arrearsMessage && (
                    <p
                      role="status"
                      className="admin-social-members__arrears-ok"
                    >
                      {arrearsMessage}
                    </p>
                  )}

                  {arrearsError && (
                    <p
                      role="alert"
                      className="admin-social-members__error-text"
                    >
                      {arrearsError}
                    </p>
                  )}
                </section>
              )}

              <h2>Historique mensuel</h2>

              {(!file.contributions || file.contributions.length === 0) && (
                <AdminEmpty message="Aucune offrande générée pour ce membre pour l'instant." />
              )}

              {file.contributions?.length > 0 && (
                <div className="admin-social-members__calendar">
                  {file.contributions.map((contribution) => {
                    const meta = STATUS[contribution.status] ?? STATUS.non_paye;
                    const paid = contribution.status === "paye";

                    return (
                      <div
                        key={`${contribution.year}-${contribution.month}`}
                        className={`admin-social-members__month admin-social-members__month--${contribution.status}`}
                        title={`${monthLabel(contribution.month)} ${contribution.year} — ${meta.label}`}
                      >
                        {paid ? (
                          <Check size={14} aria-hidden="true" />
                        ) : (
                          <X size={14} aria-hidden="true" />
                        )}
                        <span className="admin-social-members__month-label">
                          {monthLabel(contribution.month).slice(0, 3)} {contribution.year}
                        </span>
                        <span className="admin-social-members__month-amount">
                          {money(contribution.amountPaid)} / {money(contribution.amountDue)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SocialMemberSearch;
