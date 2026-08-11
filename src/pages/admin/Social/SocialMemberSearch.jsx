import { useCallback, useEffect, useRef, useState } from "react";

import { Check, Search, X } from "lucide-react";

import { fetchMemberSocialFile, searchSocialMembers } from "../../../services/social";

import useAsyncData from "../../../hooks/useAsyncData";
import usePageMeta from "../../../hooks/usePageMeta";

import {
  AdminEmpty,
  AdminError,
  AdminLoading,
} from "../../../components/admin/AdminFeedback";

import {
  STATUS,
  churchLabel,
  formatDateTime,
  memberMatricule,
  money,
  monthLabel,
} from "./socialShared";

import "./SocialMemberSearch.scss";

const SEARCH_DELAY_MS = 400;

const SocialMemberSearch = () => {
  usePageMeta({
    title: "Service Social — Recherche membre",
    description:
      "Rechercher un membre et consulter son historique complet de cotisations sociales.",
  });

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

  const selectMember = (found) => {
    setSelectedId(found.id);
    setSelectedSummary(found);
    setResults([]);
    setQuery("");
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
                    {churchLabel(found.church)}
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
                    <dd>{churchLabel(file.member?.church)}</dd>
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
                  <span>Dernière cotisation</span>
                  <strong>{formatDateTime(file.totals?.lastPaymentAt)}</strong>
                </li>
              </ul>

              <h2>Historique mensuel</h2>

              {(!file.contributions || file.contributions.length === 0) && (
                <AdminEmpty message="Aucune cotisation générée pour ce membre pour l'instant." />
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
