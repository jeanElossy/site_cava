import { useCallback, useEffect, useRef, useState } from "react";

import {
  Ban,
  Check,
  Clock,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import {
  cancelSocialAid,
  createSocialAid,
  fetchSocialAids,
  refuseSocialAid,
  searchSocialMembers,
  validateSocialAid,
} from "../../../services/social";

import { socialAidTypes } from "../../../services/api";
import { uploadFile } from "../../../services/uploads";
import { currentUser } from "../../../services/auth";
import { SOCIAL_DECISION_ROLES, SOCIAL_WRITE_ROLES } from "../../../routes/roleGroups";

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
  formatDateTime,
  memberMatricule,
  memberName,
  money,
  recordedByLabel,
  useChurchOptions,
} from "./socialShared";

import "./SocialAidsAdmin.scss";

const AID_STATUS = {
  en_attente: { label: "En attente", icon: Clock },
  payee: { label: "Payée", icon: Check },
  refusee: { label: "Refusée", icon: X },
  annulee: { label: "Annulée", icon: Ban },
};

const STATUS_FILTERS = [
  ["", "Tous"],
  ["en_attente", "En attente"],
  ["payee", "Payée"],
  ["refusee", "Refusée"],
  ["annulee", "Annulée"],
];

// Même filtre de sécurité que DonationsAdmin.jsx#safeProofUrl : la
// pièce justificative vient de notre propre signature Cloudinary, une
// adresse d'un autre hôte n'a rien à faire ici et ne doit jamais
// devenir un lien cliquable dans l'administration.
const CLOUDINARY_PREFIX = "https://res.cloudinary.com/";

const safeProofUrl = (value) =>
  typeof value === "string" && value.startsWith(CLOUDINARY_PREFIX) ? value : "";

const canWrite = () => SOCIAL_WRITE_ROLES.includes(currentUser()?.role);
const canDecide = () => SOCIAL_DECISION_ROLES.includes(currentUser()?.role);
const canCancel = () => ["admin", "social_admin"].includes(currentUser()?.role);

const SocialAidsAdmin = () => {
  usePageMeta({
    title: "Service Social — Aides sociales",
    description:
      "Suivi des demandes d'aide sociale, de leur création à leur décaissement ou leur refus.",
  });

  const { options: churchOptions } = useChurchOptions();

  const [church, setChurch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  const [newOpen, setNewOpen] = useState(false);
  const [validating, setValidating] = useState(null);
  const [refusing, setRefusing] = useState(null);
  const [cancelling, setCancelling] = useState(null);

  // Anti-rebond de la recherche, même pattern que AdminCrud/index.jsx —
  // la page revient à 1 dès qu'une nouvelle recherche part, sinon une
  // page 3 vide s'afficherait le temps que l'utilisateur comprenne
  // pourquoi sa recherche ne montre rien.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search]);

  const changeChurch = (value) => {
    setChurch(value);
    setPage(1);
  };

  const changeStatus = (value) => {
    setStatusFilter(value);
    setPage(1);
  };

  const load = useCallback(
    () =>
      fetchSocialAids({
        ...(church ? { church } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        page,
        limit: 20,
      }),
    [church, statusFilter, debouncedSearch, page]
  );

  const { data, loading, error, reload } = useAsyncData(load);

  const items = data?.items ?? [];
  const meta = data?.meta ?? {};
  const pages = meta.pages ?? (meta.total && meta.limit ? Math.ceil(meta.total / meta.limit) : 1);

  const afterWrite = () => {
    setNewOpen(false);
    setValidating(null);
    setRefusing(null);
    setCancelling(null);
    reload();
  };

  return (
    <div className="admin-social-aids">
      <header className="admin-social-aids__header">
        <div>
          <h1>Aides sociales</h1>
          <p>
            Décaissements de la caisse sociale : une demande est payée
            immédiatement au moment de sa validation.
          </p>
        </div>

        <div className="admin-social-aids__header-actions">
          <label className="admin-social-aids__church-select">
            <span>Église</span>
            <select value={church} onChange={(event) => changeChurch(event.target.value)}>
              <option value="">Toutes les églises</option>
              {churchOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button type="button" className="admin-social-aids__refresh" onClick={reload}>
            <RefreshCw size={17} aria-hidden="true" />
            Actualiser
          </button>

          {canWrite() && (
            <button
              type="button"
              className="admin-social-aids__new"
              onClick={() => setNewOpen(true)}
            >
              <Plus size={17} aria-hidden="true" />
              Nouvelle demande
            </button>
          )}
        </div>
      </header>

      <div className="admin-social-aids__search">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher un bénéficiaire (nom ou matricule)"
          aria-label="Rechercher un bénéficiaire"
        />
      </div>

      <div className="admin-social-aids__filters" role="group" aria-label="Filtrer par statut">
        {STATUS_FILTERS.map(([value, label]) => (
          <button
            key={value || "all"}
            type="button"
            className={
              statusFilter === value
                ? "admin-social-aids__filter admin-social-aids__filter--active"
                : "admin-social-aids__filter"
            }
            aria-pressed={statusFilter === value}
            onClick={() => changeStatus(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <AdminLoading />}
      {error && <AdminError message={error} onRetry={reload} />}

      {!loading && !error && items.length === 0 && (
        <AdminEmpty
          message={
            statusFilter || debouncedSearch
              ? "Aucune aide ne correspond à ces filtres."
              : "Aucune demande d'aide enregistrée."
          }
        />
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="admin-social-aids__table-wrap">
            <table className="admin-social-aids__table">
              <thead>
                <tr>
                  <th scope="col">Référence</th>
                  <th scope="col">Bénéficiaire</th>
                  <th scope="col">Église</th>
                  <th scope="col">Type d&apos;aide</th>
                  <th scope="col">Montant</th>
                  <th scope="col">Motif</th>
                  <th scope="col">Statut</th>
                  <th scope="col">Demandé par</th>
                  <th scope="col">Décidé par / le</th>
                  <th scope="col" className="admin-social-aids__actions-col">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {items.map((aid) => {
                  const statusMeta = AID_STATUS[aid.status] ?? AID_STATUS.en_attente;
                  const Icon = statusMeta.icon;
                  const proofUrl = safeProofUrl(aid.proofUrl);

                  return (
                    <tr key={aid.id}>
                      {/* `data-label` : sous 760 px chaque ligne devient
                          une carte, cet intitulé remplaçant l'en-tête de
                          colonne (mixin `admin-stacked-table`). */}
                      <td data-label="Référence">{aid.reference ?? "—"}</td>

                      <td data-label="Bénéficiaire">
                        <span className="admin-social-aids__member-name">
                          {memberName(aid.member)}
                        </span>
                        <span className="admin-social-aids__member-matricule">
                          {memberMatricule(aid.member)}
                        </span>
                      </td>

                      <td data-label="Église">{churchLabelFrom(churchOptions, aid.church)}</td>
                      <td data-label="Type d'aide">{aid.aidType?.name ?? "—"}</td>
                      <td className="admin-social-aids__amount" data-label="Montant">
                        {money(aid.amount)}
                      </td>
                      <td className="admin-social-aids__motif" data-label="Motif">
                        {aid.motif ?? "—"}
                      </td>

                      <td data-label="Statut">
                        <span
                          className={`admin-social-aids__status admin-social-aids__status--${aid.status}`}
                        >
                          <Icon size={13} aria-hidden="true" />
                          {statusMeta.label}
                        </span>

                        {aid.status === "refusee" && aid.decisionNote && (
                          <span className="admin-social-aids__reason">{aid.decisionNote}</span>
                        )}

                        {aid.status === "annulee" && aid.cancelReason && (
                          <span className="admin-social-aids__reason">{aid.cancelReason}</span>
                        )}
                      </td>

                      <td data-label="Demandé par">{recordedByLabel(aid.requestedBy)}</td>

                      <td data-label="Décidé par / le">
                        {aid.decidedBy ? (
                          <>
                            <span>{recordedByLabel(aid.decidedBy)}</span>
                            <span className="admin-social-aids__decided-at">
                              {formatDateTime(aid.decidedAt)}
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="admin-social-aids__actions-col">
                        <div className="admin-social-aids__actions">
                          {proofUrl && (
                            <a
                              className="admin-social-aids__action"
                              href={proofUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Paperclip size={13} aria-hidden="true" />
                              Pièce jointe
                            </a>
                          )}

                          {aid.status === "en_attente" && canDecide() && (
                            <>
                              <button
                                type="button"
                                className="admin-social-aids__action admin-social-aids__action--validate"
                                onClick={() => setValidating(aid)}
                              >
                                <Check size={13} aria-hidden="true" />
                                Valider
                              </button>

                              <button
                                type="button"
                                className="admin-social-aids__action admin-social-aids__action--refuse"
                                onClick={() => setRefusing(aid)}
                              >
                                <X size={13} aria-hidden="true" />
                                Refuser
                              </button>
                            </>
                          )}

                          {aid.status === "payee" && canCancel() && (
                            <button
                              type="button"
                              className="admin-social-aids__action admin-social-aids__action--cancel"
                              onClick={() => setCancelling(aid)}
                            >
                              <Ban size={13} aria-hidden="true" />
                              Annuler
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="admin-social-aids__pagination">
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

      {newOpen && (
        <NewAidModal
          defaultChurch={church}
          churchOptions={churchOptions}
          onClose={() => setNewOpen(false)}
          onDone={afterWrite}
        />
      )}

      {validating && (
        <ValidateModal aid={validating} onClose={() => setValidating(null)} onDone={afterWrite} />
      )}

      {refusing && (
        <MotifDecisionModal
          aid={refusing}
          title="Refuser cette demande"
          confirmLabel="Refuser"
          action={(id, motif) => refuseSocialAid(id, motif)}
          onClose={() => setRefusing(null)}
          onDone={afterWrite}
        />
      )}

      {cancelling && (
        <MotifDecisionModal
          aid={cancelling}
          title="Annuler cette aide payée"
          confirmLabel="Annuler l'aide"
          description="Ne supprime rien : une écriture de compensation restaure le solde de la caisse."
          action={(id, motif) => cancelSocialAid(id, motif)}
          onClose={() => setCancelling(null)}
          onDone={afterWrite}
        />
      )}
    </div>
  );
};

// ------------------------------------------------------------------
// VALIDATION (paiement immédiat)
// ------------------------------------------------------------------
const ValidateModal = ({ aid, onClose, onDone }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");

    try {
      await validateSocialAid(aid.id);
      onDone();
    } catch (caught) {
      // Message du backend affiché tel quel (ex. solde de caisse
      // insuffisant) — ne jamais le reformuler, voir le contrat API.
      setError(caught.message ?? "La validation a échoué.");
      setBusy(false);
    }
  };

  return (
    <AdminModal
      title="Valider et payer cette aide"
      description="Le montant sera immédiatement décaissé de la caisse sociale de l'église du bénéficiaire."
      onClose={onClose}
    >
      <div className="admin-social-aids__decision">
        <dl className="admin-social-aids__decision-details">
          <div><dt>Bénéficiaire</dt><dd>{memberName(aid.member)}</dd></div>
          <div><dt>Type d&apos;aide</dt><dd>{aid.aidType?.name ?? "—"}</dd></div>
          <div><dt>Montant</dt><dd>{money(aid.amount)}</dd></div>
          <div><dt>Motif</dt><dd>{aid.motif}</dd></div>
        </dl>

        {error && (
          <p className="admin-social-aids__decision-error" role="alert">
            {error}
          </p>
        )}

        <div className="admin-social-aids__decision-actions">
          <button type="button" onClick={onClose} disabled={busy}>
            Annuler
          </button>

          <button
            type="button"
            className="admin-social-aids__decision-confirm admin-social-aids__decision-confirm--validate"
            onClick={submit}
            disabled={busy}
          >
            {busy ? "Validation en cours…" : "Valider et payer"}
          </button>
        </div>
      </div>
    </AdminModal>
  );
};

// ------------------------------------------------------------------
// REFUS / ANNULATION — motif obligatoire (même pattern que ExemptModal
// dans SocialContributionsAdmin.jsx)
// ------------------------------------------------------------------
const MotifDecisionModal = ({ aid, title, description, confirmLabel, action, onClose, onDone }) => {
  const [motif, setMotif] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!motif.trim()) {
      setError("Le motif est obligatoire.");

      return;
    }

    setBusy(true);
    setError("");

    try {
      await action(aid.id, motif.trim());
      onDone();
    } catch (caught) {
      setError(caught.message ?? "La décision n'a pas pu être enregistrée.");
      setBusy(false);
    }
  };

  return (
    <AdminModal
      title={title}
      description={description ?? `${memberName(aid.member)} — ${money(aid.amount)}`}
      onClose={onClose}
    >
      <div className="admin-social-aids__decision">
        <label className="admin-social-aids__decision-motif">
          <span>Motif (obligatoire)</span>
          <textarea
            value={motif}
            onChange={(event) => setMotif(event.target.value)}
            rows={3}
            placeholder="Ex. : dossier incomplet, décision du conseil…"
          />
        </label>

        {error && (
          <p className="admin-social-aids__decision-error" role="alert">
            {error}
          </p>
        )}

        <div className="admin-social-aids__decision-actions">
          <button type="button" onClick={onClose} disabled={busy}>
            Fermer
          </button>

          <button
            type="button"
            className="admin-social-aids__decision-confirm admin-social-aids__decision-confirm--danger"
            onClick={submit}
            disabled={busy}
          >
            {busy ? "Enregistrement…" : confirmLabel}
          </button>
        </div>
      </div>
    </AdminModal>
  );
};

// ------------------------------------------------------------------
// NOUVELLE DEMANDE D'AIDE
// ------------------------------------------------------------------
const SEARCH_DELAY_MS = 400;

const NewAidModal = ({ defaultChurch, churchOptions, onClose, onDone }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [member, setMember] = useState(null);

  const [aidTypeId, setAidTypeId] = useState("");
  const [amount, setAmount] = useState("");
  const [motif, setMotif] = useState("");
  const [description, setDescription] = useState("");

  const [proofUrl, setProofUrl] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitResult, setSubmitResult] = useState(null);

  const timerRef = useRef(null);

  const loadAidTypes = useCallback(
    () => socialAidTypes.listAdmin().then((list) => list.filter((item) => item.active)),
    []
  );

  const { data: aidTypes } = useAsyncData(loadAidTypes);

  useEffect(() => {
    // Rien à chercher tant qu'un membre est déjà choisi ou que le champ
    // est vide — même pattern que NewContributionModal dans
    // SocialContributionsAdmin.jsx.
    if (member || !query.trim()) return undefined;

    clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchError("");

      try {
        const found = await searchSocialMembers({
          q: query.trim(),
          ...(defaultChurch ? { church: defaultChurch } : {}),
        });

        setResults(found ?? []);
      } catch (caught) {
        setSearchError(caught.message ?? "La recherche a échoué.");
      } finally {
        setSearching(false);
      }
    }, SEARCH_DELAY_MS);

    return () => clearTimeout(timerRef.current);
  }, [query, member, defaultChurch]);

  const resultsToShow = member || !query.trim() ? [] : results;

  const selectMember = (found) => {
    setMember(found);
    setResults([]);
  };

  const handleProofFile = async (file) => {
    if (!file) return;

    setUploadBusy(true);
    setUploadError("");

    try {
      // La pièce justificative est OPTIONNELLE : un échec d'envoi
      // n'empêche jamais de soumettre le reste du formulaire, il
      // reste juste sans pièce jointe (voir le contrat de cette page).
      const result = await uploadFile(file, { folder: "socialAids", accept: "image" });

      setProofUrl(result.url);
    } catch (caught) {
      setUploadError(caught.message ?? "L'envoi de la pièce jointe a échoué.");
    } finally {
      setUploadBusy(false);
    }
  };

  const submit = async () => {
    if (!member) {
      setSubmitError("Sélectionnez un membre bénéficiaire.");

      return;
    }

    if (!aidTypeId) {
      setSubmitError("Sélectionnez un type d'aide.");

      return;
    }

    if (!Number(amount) || Number(amount) <= 0) {
      setSubmitError("Le montant doit être supérieur à zéro.");

      return;
    }

    if (!motif.trim()) {
      setSubmitError("Le motif est obligatoire.");

      return;
    }

    setSubmitBusy(true);
    setSubmitError("");

    try {
      const result = await createSocialAid({
        memberId: member.id,
        aidTypeId,
        amount: Number(amount),
        motif: motif.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(proofUrl ? { proofUrl } : {}),
      });

      setSubmitResult(result);
    } catch (caught) {
      setSubmitError(caught.message ?? "La demande n'a pas pu être enregistrée.");
    } finally {
      setSubmitBusy(false);
    }
  };

  return (
    <AdminModal
      title="Nouvelle demande d'aide"
      description="Recherchez le membre bénéficiaire, puis renseignez le type d'aide et le montant demandé."
      onClose={onClose}
    >
      <div className="admin-social-aids__new-body">
        {!member && !submitResult && (
          <div className="admin-social-aids__new-search">
            <label>
              <span>Rechercher un membre</span>
              <div className="admin-social-aids__new-search-field">
                <Search size={16} aria-hidden="true" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Matricule, nom, prénom ou téléphone"
                  autoFocus
                />
              </div>
            </label>

            {searching && <p className="admin-social-aids__new-hint">Recherche…</p>}

            {searchError && (
              <p role="alert" className="admin-social-aids__new-error">
                {searchError}
              </p>
            )}

            {!searching && !searchError && query.trim() && resultsToShow.length === 0 && (
              <p className="admin-social-aids__new-hint">Aucun membre trouvé.</p>
            )}

            {resultsToShow.length > 0 && (
              <ul className="admin-social-aids__new-results">
                {resultsToShow.map((found) => (
                  <li key={found.id}>
                    <button type="button" onClick={() => selectMember(found)}>
                      <strong>{memberMatricule(found)}</strong>
                      <span>
                        {found.firstName} {found.lastName}
                      </span>
                      <span className="admin-social-aids__new-results-church">
                        {churchLabelFrom(churchOptions, found.church)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {member && !submitResult && (
          <div className="admin-social-aids__new-form">
            <div className="admin-social-aids__new-member-header">
              <div>
                <strong>
                  {member.firstName} {member.lastName}
                </strong>
                <span>{memberMatricule(member)} — {churchLabelFrom(churchOptions, member.church)}</span>
              </div>

              <button type="button" onClick={() => setMember(null)}>
                Changer de membre
              </button>
            </div>

            <label>
              <span>Type d&apos;aide</span>
              <select value={aidTypeId} onChange={(event) => setAidTypeId(event.target.value)}>
                <option value="">Choisir un type</option>
                {(aidTypes ?? []).map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Montant (F)</span>
              <input
                type="number"
                min="0"
                step="500"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>

            <label>
              <span>Motif (obligatoire)</span>
              <textarea
                value={motif}
                onChange={(event) => setMotif(event.target.value)}
                rows={2}
                placeholder="Ex. : décès du conjoint, hospitalisation…"
              />
            </label>

            <label>
              <span>Description (facultatif)</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                placeholder="Détails complémentaires utiles à la décision."
              />
            </label>

            <label>
              <span>Pièce justificative (facultatif)</span>
              <input
                type="file"
                accept="image/*"
                disabled={uploadBusy}
                onChange={(event) => {
                  handleProofFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />

              {uploadBusy && <p className="admin-social-aids__new-hint">Envoi en cours…</p>}
              {uploadError && (
                <p role="alert" className="admin-social-aids__new-error">
                  {uploadError}
                </p>
              )}
              {proofUrl && !uploadBusy && (
                <p className="admin-social-aids__new-hint">Pièce jointe envoyée.</p>
              )}
            </label>

            {submitError && (
              <p role="alert" className="admin-social-aids__new-error">
                {submitError}
              </p>
            )}

            <button
              type="button"
              className="admin-social-aids__new-submit"
              onClick={submit}
              disabled={submitBusy}
            >
              {submitBusy ? "Enregistrement…" : "Enregistrer la demande"}
            </button>
          </div>
        )}

        {submitResult && (
          <div className="admin-social-aids__new-result">
            <Check size={22} aria-hidden="true" />
            <p>
              {/* Une référence n'est attribuée qu'au moment de la
                  décision (voir SocialAid.js côté backend) — une
                  demande fraîchement créée reste "en attente" sans
                  référence, contrairement à une cotisation ou un don. */}
              Demande enregistrée pour <strong>{memberName(member)}</strong>, en
              attente de validation.
            </p>

            <button type="button" className="admin-social-aids__new-done" onClick={onDone}>
              Terminer
            </button>
          </div>
        )}
      </div>
    </AdminModal>
  );
};

export default SocialAidsAdmin;
