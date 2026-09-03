import { useCallback, useEffect, useRef, useState } from "react";

import {
  AlertTriangle,
  Ban,
  Check,
  Clock,
  FileText,
  MessageCircle,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wand2,
  X,
} from "lucide-react";

import {
  exemptContribution,
  fetchContributionReceipt,
  fetchMemberSocialFile,
  fetchSocialContributions,
  recordSocialPayments,
  searchSocialMembers,
} from "../../../services/social";

import { currentUser } from "../../../services/auth";
import { SOCIAL_WRITE_ROLES } from "../../../routes/roleGroups";

import useAsyncData from "../../../hooks/useAsyncData";
import usePageMeta from "../../../hooks/usePageMeta";

import AdminModal from "../../../components/admin/AdminModal";

import {
  AdminEmpty,
  AdminError,
  AdminLoading,
} from "../../../components/admin/AdminFeedback";

import {
  MONTH_OPTIONS,
  SOCIAL_LEGACY_START_YEAR,
  allocateAcrossMonths,
  buildWhatsAppMessage,
  churchLabelFrom,
  downloadBlob,
  formatDateTime,
  isLate,
  memberMatricule,
  memberName,
  money,
  monthLabel,
  recordedByLabel,
  STATUS,
  useChurchOptions,
  whatsAppUrl,
} from "./socialShared";

import "./SocialContributionsAdmin.scss";

const STATUS_ICON = {
  paye: Check,
  non_paye: X,
  partiel: Clock,
  exonere: Ban,
  annule: X,
};

const STATUS_FILTERS = [
  ["", "Tous"],
  ["paye", "Payé"],
  ["non_paye", "Non payé"],
  ["partiel", "Partiel"],
  ["retard", "En retard"],
  ["exonere", "Exonéré"],
];

const now = new Date();
// Deux ans en arrière et un en avant, mais JAMAIS avant
// SOCIAL_LEGACY_START_YEAR : plus bas, aucune ligne n'existe et le
// serveur refuserait l'encaissement. Proposer 2024 dans le sélecteur de
// mois supplémentaire ne pouvait mener qu'à une erreur.
const YEAR_OPTIONS = [
  now.getFullYear() - 2,
  now.getFullYear() - 1,
  now.getFullYear(),
  now.getFullYear() + 1,
].filter((value) => value >= SOCIAL_LEGACY_START_YEAR);

const canWrite = () => SOCIAL_WRITE_ROLES.includes(currentUser()?.role);

// L'API plafonne une page à 100 lignes (socialContribution.service.js) :
// demander davantage tronquerait silencieusement.
const PAGE_SIZE = 50;

const SocialContributionsAdmin = () => {
  usePageMeta({
    title: "Service Social — Offrandes sociales",
    description:
      "Suivi mensuel des offrandes sociales par membre, avec enregistrement de paiement et exonération.",
  });

  const { options: churchOptions } = useChurchOptions();

  const [church, setChurch] = useState("");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const [newOpen, setNewOpen] = useState(false);
  const [exempting, setExempting] = useState(null);

  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadError, setDownloadError] = useState("");

  // TOUT se filtre et se totalise côté serveur, pagination comprise.
  //
  // Avant : `limit: 300` — que l'API plafonne à 100 —, filtrage par
  // statut dans le navigateur et totaux calculés sur les lignes
  // chargées. Passé 100 membres, la liste était donc tronquée sans
  // le dire, le filtre « en retard » ne voyait pas les retardataires
  // des pages suivantes, et la barre de totaux affichait des montants
  // faux. Le serveur renvoie maintenant `meta.totals`, calculé sur le
  // mois entier quel que soit le filtre de statut ou la page.
  const load = useCallback(
    () =>
      fetchSocialContributions({
        ...(church ? { church } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        year,
        month,
        page,
        limit: PAGE_SIZE,
      }),
    [church, year, month, statusFilter, page]
  );

  const { data, loading, error, reload } = useAsyncData(load);
  const items = data?.items ?? [];

  const meta = data?.meta ?? {};
  const totals = meta.totals ?? { amountDue: 0, amountPaid: 0, remaining: 0, rate: 0 };
  const totalRows = meta.total ?? items.length;
  const totalPages = Math.max(
    Math.ceil(totalRows / (meta.perPage || PAGE_SIZE)) || 1,
    1
  );

  // Changer de période, d'église ou de filtre remet à la première page :
  // rester page 5 sur un résultat qui n'en compte que 2 afficherait un
  // tableau vide sans explication. Ajusté pendant le rendu, comme
  // ailleurs dans l'administration.
  const filtersKey = `${church}|${year}|${month}|${statusFilter}`;
  const [lastFiltersKey, setLastFiltersKey] = useState(filtersKey);

  if (filtersKey !== lastFiltersKey) {
    setLastFiltersKey(filtersKey);
    setPage(1);
  }

  const handleDownloadReceipt = async (item) => {
    setDownloadingId(item.id);
    setDownloadError("");

    try {
      const { blob, filename } = await fetchContributionReceipt(item.id);

      downloadBlob(blob, filename);
    } catch (caught) {
      setDownloadError(caught.message ?? "Le reçu n'a pas pu être téléchargé.");
    } finally {
      setDownloadingId(null);
    }
  };

  const whatsAppHref = (item) =>
    whatsAppUrl(
      buildWhatsAppMessage({
        firstName: item.member?.firstName ?? "",
        month: monthLabel(item.month),
        year: item.year,
        amount: money(item.amountPaid || item.amountDue),
        matricule: memberMatricule(item.member),
        date: formatDateTime(item.paidAt),
        reference: item.reference ?? "—",
      })
    );

  const afterWrite = () => {
    setNewOpen(false);
    setExempting(null);
    reload();
  };

  return (
    <div className="admin-social-contributions">
      <header className="admin-social-contributions__header">
        <div>
          <h1>Offrandes sociales</h1>
          <p>
            Suivi mensuel des offrandes sociales par membre. Une ligne = un
            membre × un mois.
          </p>
        </div>

        <div className="admin-social-contributions__header-actions">
          <label className="admin-social-contributions__church-select">
            <span>Église</span>
            <select value={church} onChange={(event) => setChurch(event.target.value)}>
              <option value="">Toutes les églises</option>
              {churchOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button type="button" className="admin-social-contributions__refresh" onClick={reload}>
            <RefreshCw size={17} aria-hidden="true" />
            Actualiser
          </button>

          {canWrite() && (
            <button
              type="button"
              className="admin-social-contributions__new"
              onClick={() => setNewOpen(true)}
            >
              <Plus size={17} aria-hidden="true" />
              Nouvelle offrande
            </button>
          )}
        </div>
      </header>

      <div className="admin-social-contributions__period">
        <label>
          <span>Mois</span>
          <select value={month} onChange={(event) => setMonth(Number(event.target.value))}>
            {MONTH_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Année</span>
          <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
            {YEAR_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!loading && !error && data && (
        <ul className="admin-social-contributions__totals">
          <li>
            <span>Attendu</span>
            <strong>{money(totals.amountDue)}</strong>
          </li>
          <li>
            <span>Collecté</span>
            <strong>{money(totals.amountPaid)}</strong>
          </li>
          <li>
            <span>Reste à collecter</span>
            <strong>{money(totals.remaining)}</strong>
          </li>
          <li>
            <span>Taux</span>
            <strong>{totals.rate}%</strong>
          </li>
        </ul>
      )}

      <div className="admin-social-contributions__filters" role="group" aria-label="Filtrer par statut">
        {STATUS_FILTERS.map(([value, label]) => (
          <button
            key={value || "all"}
            type="button"
            className={
              statusFilter === value
                ? "admin-social-contributions__filter admin-social-contributions__filter--active"
                : "admin-social-contributions__filter"
            }
            aria-pressed={statusFilter === value}
            onClick={() => setStatusFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {downloadError && (
        <p className="admin-social-contributions__download-error" role="alert">
          {downloadError}
        </p>
      )}

      {loading && <AdminLoading />}
      {error && <AdminError message={error} onRetry={reload} />}

      {!loading && !error && items.length === 0 && (
        <AdminEmpty
          message={
            statusFilter
              ? "Aucune offrande ne correspond à ce filtre pour cette période."
              : "Aucune offrande générée pour cette période."
          }
        />
      )}

      {!loading && !error && items.length > 0 && (
        <div className="admin-social-contributions__table-wrap">
          <table className="admin-social-contributions__table">
            <thead>
              <tr>
                <th scope="col">Matricule</th>
                <th scope="col">Nom</th>
                <th scope="col">Mois</th>
                <th scope="col">Montant dû</th>
                <th scope="col">Montant payé</th>
                <th scope="col">Paiement</th>
                <th scope="col">Statut</th>
                <th scope="col">Agent</th>
                <th scope="col" className="admin-social-contributions__actions-col">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {items.map((item) => {
                const statusMeta = STATUS[item.status] ?? STATUS.non_paye;
                const Icon = STATUS_ICON[item.status] ?? X;
                const late = isLate(item);

                return (
                  <tr key={item.id}>
                    {/* `data-label` : sous 760 px chaque ligne devient une
                        carte, cet intitulé remplaçant l'en-tête de colonne
                        (mixin `admin-stacked-table`). */}
                    <td data-label="Matricule">{memberMatricule(item.member)}</td>
                    <td data-label="Nom">{memberName(item.member)}</td>
                    <td data-label="Mois">
                      {monthLabel(item.month)} {item.year}
                    </td>
                    <td
                      className="admin-social-contributions__amount"
                      data-label="Montant dû"
                    >
                      {money(item.amountDue)}
                    </td>
                    <td
                      className="admin-social-contributions__amount"
                      data-label="Montant payé"
                    >
                      {money(item.amountPaid)}
                    </td>
                    <td data-label="Paiement">{formatDateTime(item.paidAt)}</td>

                    <td data-label="Statut">
                      <span
                        className={`admin-social-contributions__status admin-social-contributions__status--${item.status}`}
                      >
                        <Icon size={13} aria-hidden="true" />
                        {statusMeta.label}
                      </span>

                      {late && (
                        <span className="admin-social-contributions__status admin-social-contributions__status--retard">
                          <AlertTriangle size={13} aria-hidden="true" />
                          En retard
                        </span>
                      )}
                    </td>

                    <td data-label="Agent">{recordedByLabel(item.recordedBy)}</td>

                    <td className="admin-social-contributions__actions-col">
                      <ContributionRowMenu
                        item={item}
                        onDownloadReceipt={handleDownloadReceipt}
                        downloading={downloadingId === item.id}
                        whatsAppHref={whatsAppHref}
                        canExempt={
                          (item.status === "non_paye" || item.status === "partiel") &&
                          canWrite()
                        }
                        onExempt={() => setExempting(item)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && totalPages > 1 && (
        <nav
          className="admin-social-contributions__pagination"
          aria-label="Pagination des offrandes"
        >
          <button
            type="button"
            onClick={() => setPage((previous) => Math.max(previous - 1, 1))}
            disabled={page <= 1}
          >
            Précédent
          </button>

          <span aria-live="polite">
            Page {page} sur {totalPages}
            <small>{totalRows} ligne(s)</small>
          </span>

          <button
            type="button"
            onClick={() =>
              setPage((previous) => Math.min(previous + 1, totalPages))
            }
            disabled={page >= totalPages}
          >
            Suivant
          </button>
        </nav>
      )}

      {newOpen && (
        <NewContributionModal
          defaultChurch={church}
          churchOptions={churchOptions}
          onClose={() => setNewOpen(false)}
          onDone={afterWrite}
        />
      )}

      {exempting && (
        <ExemptModal
          contribution={exempting}
          onClose={() => setExempting(null)}
          onDone={afterWrite}
        />
      )}
    </div>
  );
};

// ------------------------------------------------------------------
// MENU D'ACTIONS PAR LIGNE
// ------------------------------------------------------------------
// Un seul déclencheur (icône « ⋮ ») plutôt que Reçu/WhatsApp/Exonérer
// alignés côte à côte, qui ne tenaient plus sur une ligne une fois les
// autres colonnes affichées — même pattern que MemberRowMenu dans
// CommunityAdmin.jsx.
const ContributionRowMenu = ({
  item,
  onDownloadReceipt,
  downloading,
  whatsAppHref,
  canExempt,
  onExempt,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  if (!item.reference && !canExempt) return null;

  return (
    <div className="admin-social-contributions__row-menu" ref={containerRef}>
      <button
        type="button"
        className="admin-social-contributions__row-menu-trigger"
        onClick={() => setOpen((previous) => !previous)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions — ${memberName(item.member)}`}
      >
        <MoreVertical size={16} aria-hidden="true" />
      </button>

      {open && (
        <div className="admin-social-contributions__row-menu-panel" role="menu">
          {item.reference && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onDownloadReceipt(item);
              }}
              disabled={downloading}
            >
              <FileText aria-hidden="true" />
              {downloading ? "Téléchargement…" : "Reçu"}
            </button>
          )}

          {item.reference && (
            <a
              role="menuitem"
              href={whatsAppHref(item)}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
            >
              <MessageCircle aria-hidden="true" />
              WhatsApp
            </a>
          )}

          {canExempt && (
            <button
              type="button"
              role="menuitem"
              className="admin-social-contributions__row-menu-danger"
              onClick={() => {
                setOpen(false);
                onExempt();
              }}
            >
              <Ban aria-hidden="true" />
              Exonérer
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ------------------------------------------------------------------
// EXONÉRATION
// ------------------------------------------------------------------
const ExemptModal = ({ contribution, onClose, onDone }) => {
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
      await exemptContribution(contribution.id, motif.trim());
      onDone();
    } catch (caught) {
      setError(caught.message ?? "L'exonération n'a pas pu être enregistrée.");
      setBusy(false);
    }
  };

  return (
    <AdminModal
      title="Exonérer cette offrande"
      description={`${memberName(contribution.member)} — ${monthLabel(contribution.month)} ${contribution.year}`}
      onClose={onClose}
    >
      <div className="admin-social-contributions__exempt">
        <label>
          <span>Motif (obligatoire)</span>
          <textarea
            value={motif}
            onChange={(event) => setMotif(event.target.value)}
            rows={3}
            placeholder="Ex. : situation de précarité, décision du conseil…"
          />
        </label>

        {error && (
          <p className="admin-social-contributions__exempt-error" role="alert">
            {error}
          </p>
        )}

        <div className="admin-social-contributions__exempt-actions">
          <button type="button" onClick={onClose} disabled={busy}>
            Annuler
          </button>

          <button
            type="button"
            className="admin-social-contributions__exempt-confirm"
            onClick={submit}
            disabled={busy}
          >
            {busy ? "Enregistrement…" : "Exonérer"}
          </button>
        </div>
      </div>
    </AdminModal>
  );
};

// ------------------------------------------------------------------
// NOUVELLE COTISATION
// ------------------------------------------------------------------
const SEARCH_DELAY_MS = 400;

const NewContributionModal = ({ defaultChurch, churchOptions, onClose, onDone }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [member, setMember] = useState(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState("");

  // clé "année-mois" -> { checked, amount, contribution }
  const [selections, setSelections] = useState({});
  const [extraMonths, setExtraMonths] = useState([]);

  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitResult, setSubmitResult] = useState(null);

  const [resultDownloadingKey, setResultDownloadingKey] = useState(null);
  const [resultDownloadError, setResultDownloadError] = useState("");

  const timerRef = useRef(null);

  useEffect(() => {
    // Rien à chercher tant qu'un membre est déjà choisi ou que le
    // champ est vide : pas de setState ici (voir la règle
    // react-hooks/set-state-in-effect) — `resultsToShow` ci-dessous
    // masque `results` dans ce cas sans avoir besoin de le vider.
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

  const selectMember = async (found) => {
    setMember(found);
    setResults([]);
    setFileLoading(true);
    setFileError("");
    setSelections({});
    setSpreadAmount("");
    setSpreadNotice("");

    try {
      const memberFile = await fetchMemberSocialFile(found.id);

      const initial = {};

      (memberFile.contributions ?? [])
        .filter((c) => c.status === "non_paye" || c.status === "partiel")
        .forEach((c) => {
          initial[`${c.year}-${c.month}`] = {
            checked: false,
            amount: Math.max((c.amountDue ?? 0) - (c.amountPaid ?? 0), 0),
            contribution: c,
          };
        });

      setSelections(initial);
    } catch (caught) {
      setFileError(caught.message ?? "La fiche du membre n'a pas pu être chargée.");
    } finally {
      setFileLoading(false);
    }
  };

  // ---- Répartition d'un montant global sur plusieurs mois --------
  //
  // Le responsable encaisse une somme (« le membre m'a remis 5 000 F »)
  // et doit pouvoir dire, APRÈS échange avec le membre, si elle couvre
  // un seul mois ou plusieurs. Rien n'est deviné : ce bouton ne fait que
  // PRÉ-REMPLIR la liste ci-dessous, que le responsable relit, corrige
  // et valide. Un montant destiné à un seul mois se saisit toujours
  // directement sur ce mois — le montant mensuel reste un plancher, pas
  // un plafond.
  //
  // Calculé ici plutôt que sur le serveur, et volontairement : la
  // répartition passe ensuite par le circuit de paiement habituel, mois
  // par mois. Si un autre agent a réglé un de ces mois entretemps,
  // `recordPayments` le signale ligne à ligne (verrou optimiste) au lieu
  // d'écraser sa saisie.
  const [spreadAmount, setSpreadAmount] = useState("");
  const [spreadNotice, setSpreadNotice] = useState("");

  const applySpread = () => {
    const total = Number(spreadAmount);

    if (!Number.isFinite(total) || total <= 0) {
      setSpreadNotice("Indiquez le montant remis par le membre.");

      return;
    }

    const { parts, left } = allocateAcrossMonths(
      Object.entries(selections).map(([key, entry]) => ({
        key,
        year: entry.contribution.year,
        month: entry.contribution.month,
        owed: Math.max(
          (entry.contribution.amountDue ?? 0) - (entry.contribution.amountPaid ?? 0),
          0
        ),
      })),
      total
    );

    if (parts.length === 0) {
      setSpreadNotice("Aucun mois impayé à couvrir pour ce membre.");

      return;
    }

    const next = { ...selections };

    for (const item of parts) {
      next[item.key] = { ...next[item.key], checked: true, amount: item.part };
    }

    setSelections(next);

    const covered = parts.map(
      (item) =>
        `${monthLabel(item.month).toLowerCase()} ${item.year}${
          item.partial ? " (partiel)" : ""
        }`
    );

    setSpreadNotice(
      `${covered.length} mois couvert(s) : ${covered.join(", ")}.` +
        (left > 0
          ? ` Il reste ${money(left)} non affecté(s) — ajoutez-les au mois de votre choix.`
          : "")
    );
  };

  const changeSelection = (key, patch) => {
    setSpreadNotice("");

    setSelections((previous) => ({
      ...previous,
      [key]: { ...previous[key], ...patch },
    }));
  };

  const addExtraMonth = () => {
    setExtraMonths((previous) => [
      ...previous,
      { year: now.getFullYear(), month: now.getMonth() + 1, amount: "" },
    ]);
  };

  const updateExtraMonth = (index, patch) => {
    setExtraMonths((previous) =>
      previous.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
    );
  };

  const removeExtraMonth = (index) => {
    setExtraMonths((previous) => previous.filter((_, rowIndex) => rowIndex !== index));
  };

  const buildPayments = () => {
    const fromSelections = Object.values(selections)
      .filter((entry) => entry.checked && Number(entry.amount) > 0)
      .map((entry) => ({
        year: entry.contribution.year,
        month: entry.contribution.month,
        amount: Number(entry.amount),
      }));

    const fromExtra = extraMonths
      .filter((row) => Number(row.amount) > 0)
      .map((row) => ({
        year: Number(row.year),
        month: Number(row.month),
        amount: Number(row.amount),
      }));

    return [...fromSelections, ...fromExtra];
  };

  const submit = async () => {
    const payments = buildPayments();

    if (!member || payments.length === 0) {
      setSubmitError("Sélectionnez au moins un mois avec un montant supérieur à zéro.");

      return;
    }

    setSubmitBusy(true);
    setSubmitError("");

    try {
      const response = await recordSocialPayments({ memberId: member.id, payments });

      // La fiche à jour du membre fournit le montant versé et la date
      // de paiement, dont le message WhatsApp a besoin et que la
      // réponse du POST ne porte pas.
      const refreshed = await fetchMemberSocialFile(member.id);

      const lookup = new Map(
        (refreshed.contributions ?? []).map((c) => [`${c.year}-${c.month}`, c])
      );

      // L'IDENTIFIANT, lui, est repris du résultat de paiement et NON
      // de la fiche.
      //
      // `normalize()` (services/http.js) n'ajoute `id` qu'au PREMIER
      // niveau de la réponse. `contributions` est un tableau imbriqué
      // dans un objet : ses éléments gardent `_id` et n'ont jamais de
      // `id`. Le reçu appelait donc `/contributions/undefined/recu`, à
      // quoi le serveur répondait « Cotisation introuvable » — alors
      // que le paiement, lui, était bien enregistré.
      const rows = (response.results ?? []).map((result) => {
        const contribution = lookup.get(`${result.year}-${result.month}`);

        if (!contribution) return { ...result, contribution: null };

        const id = result.id ?? contribution.id ?? contribution._id;

        return {
          ...result,
          contribution: { ...contribution, id: id ? String(id) : undefined },
        };
      });

      setSubmitResult({ rows, totalPaid: response.totalPaid });
    } catch (caught) {
      setSubmitError(caught.message ?? "L'enregistrement a échoué.");
    } finally {
      setSubmitBusy(false);
    }
  };

  const handleDownload = async (row, key) => {
    if (!row.contribution?.id) return;

    setResultDownloadingKey(key);
    setResultDownloadError("");

    try {
      const { blob, filename } = await fetchContributionReceipt(row.contribution.id);

      downloadBlob(blob, filename);
    } catch (caught) {
      setResultDownloadError(caught.message ?? "Le reçu n'a pas pu être téléchargé.");
    } finally {
      setResultDownloadingKey(null);
    }
  };

  return (
    <AdminModal
      title="Nouvelle offrande"
      description="Recherchez un membre, sélectionnez les mois à régler puis enregistrez le paiement."
      onClose={onClose}
    >
      <div className="admin-social-contributions__new-form">
        {!member && (
          <div className="admin-social-contributions__new-search">
            <label>
              <span>Rechercher un membre</span>
              <div className="admin-social-contributions__new-search-field">
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

            {searching && <p className="admin-social-contributions__new-hint">Recherche…</p>}

            {searchError && (
              <p role="alert" className="admin-social-contributions__new-error">
                {searchError}
              </p>
            )}

            {!searching && !searchError && query.trim() && resultsToShow.length === 0 && (
              <p className="admin-social-contributions__new-hint">Aucun membre trouvé.</p>
            )}

            {resultsToShow.length > 0 && (
              <ul className="admin-social-contributions__new-results">
                {resultsToShow.map((found) => (
                  <li key={found.id}>
                    <button type="button" onClick={() => selectMember(found)}>
                      <strong>{memberMatricule(found)}</strong>
                      <span>
                        {found.firstName} {found.lastName}
                      </span>
                      <span className="admin-social-contributions__new-results-church">
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
          <div className="admin-social-contributions__new-member">
            <div className="admin-social-contributions__new-member-header">
              <div>
                <strong>
                  {member.firstName} {member.lastName}
                </strong>
                <span>{memberMatricule(member)} — {churchLabelFrom(churchOptions, member.church)}</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setMember(null);
                  setSubmitResult(null);
                  setSubmitError("");
                }}
              >
                Changer de membre
              </button>
            </div>

            {fileLoading && <AdminLoading label="Chargement de la fiche…" />}
            {fileError && <AdminError message={fileError} />}

            {!fileLoading && !fileError && (
              <>
                {Object.keys(selections).length > 0 && (
                  <div className="admin-social-contributions__spread">
                    <p className="admin-social-contributions__spread-lead">
                      Le montant remis couvre-t-il plusieurs mois ? Saisissez-le
                      ici pour le répartir sur les mois dus, du plus ancien au
                      plus récent. Vous pourrez relire et corriger avant
                      d&apos;enregistrer.
                    </p>

                    <div className="admin-social-contributions__spread-row">
                      <label>
                        <span>Montant remis par le membre</span>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={spreadAmount}
                          onChange={(event) => {
                            setSpreadAmount(event.target.value);
                            setSpreadNotice("");
                          }}
                          placeholder="Ex. 5000"
                        />
                      </label>

                      <button type="button" onClick={applySpread}>
                        <Wand2 size={15} aria-hidden="true" />
                        Répartir
                      </button>
                    </div>

                    <p className="admin-social-contributions__spread-hint">
                      Pour une offrande généreuse destinée à un seul mois,
                      n&apos;utilisez pas ce champ : saisissez le montant
                      directement sur le mois concerné ci-dessous.
                    </p>

                    {spreadNotice && (
                      <p
                        role="status"
                        className="admin-social-contributions__spread-notice"
                      >
                        {spreadNotice}
                      </p>
                    )}
                  </div>
                )}

                {Object.keys(selections).length === 0 ? (
                  <p className="admin-social-contributions__new-hint">
                    Aucun mois impayé ou partiel récent pour ce membre.
                  </p>
                ) : (
                  <ul className="admin-social-contributions__new-months">
                    {Object.entries(selections).map(([key, entry]) => (
                      <li key={key}>
                        <label>
                          <input
                            type="checkbox"
                            checked={entry.checked}
                            onChange={(event) =>
                              changeSelection(key, { checked: event.target.checked })
                            }
                          />
                          <span>
                            {monthLabel(entry.contribution.month)} {entry.contribution.year}
                            {entry.contribution.status === "partiel" && " (partiel)"}
                          </span>
                        </label>

                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={entry.amount}
                          disabled={!entry.checked}
                          onChange={(event) =>
                            changeSelection(key, { amount: event.target.value })
                          }
                        />
                      </li>
                    ))}
                  </ul>
                )}

                <div className="admin-social-contributions__new-extra">
                  <div className="admin-social-contributions__new-extra-header">
                    <span>Ajouter un autre mois</span>
                    <button type="button" onClick={addExtraMonth}>
                      <Plus size={14} aria-hidden="true" />
                      Ajouter
                    </button>
                  </div>

                  {extraMonths.map((row, index) => (
                    <div className="admin-social-contributions__new-extra-row" key={index}>
                      <select
                        value={row.month}
                        onChange={(event) =>
                          updateExtraMonth(index, { month: Number(event.target.value) })
                        }
                      >
                        {MONTH_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>

                      <select
                        value={row.year}
                        onChange={(event) =>
                          updateExtraMonth(index, { year: Number(event.target.value) })
                        }
                      >
                        {YEAR_OPTIONS.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="0"
                        step="100"
                        placeholder="Montant"
                        value={row.amount}
                        onChange={(event) =>
                          updateExtraMonth(index, { amount: event.target.value })
                        }
                      />

                      <button
                        type="button"
                        className="admin-social-contributions__new-extra-remove"
                        onClick={() => removeExtraMonth(index)}
                        aria-label="Retirer ce mois"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>

                {submitError && (
                  <p role="alert" className="admin-social-contributions__new-error">
                    {submitError}
                  </p>
                )}

                <button
                  type="button"
                  className="admin-social-contributions__new-submit"
                  onClick={submit}
                  disabled={submitBusy}
                >
                  {submitBusy ? "Enregistrement…" : "Enregistrer"}
                </button>
              </>
            )}
          </div>
        )}

        {submitResult && (
          <div className="admin-social-contributions__new-result">
            <p className="admin-social-contributions__new-result-total">
              Total enregistré : <strong>{money(submitResult.totalPaid)}</strong>
            </p>

            {resultDownloadError && (
              <p role="alert" className="admin-social-contributions__new-error">
                {resultDownloadError}
              </p>
            )}

            <ul className="admin-social-contributions__new-result-list">
              {submitResult.rows.map((row) => {
                const key = `${row.year}-${row.month}`;

                return (
                  <li
                    key={key}
                    className={
                      row.ok
                        ? "admin-social-contributions__new-result-row admin-social-contributions__new-result-row--ok"
                        : "admin-social-contributions__new-result-row admin-social-contributions__new-result-row--fail"
                    }
                  >
                    <div>
                      {row.ok ? <Check size={15} aria-hidden="true" /> : <X size={15} aria-hidden="true" />}
                      <span>
                        {monthLabel(row.month)} {row.year}
                      </span>
                    </div>

                    {row.ok ? (
                      <div className="admin-social-contributions__new-result-actions">
                        <span>{row.reference}</span>

                        {row.contribution && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleDownload(row, key)}
                              disabled={resultDownloadingKey === key}
                            >
                              <FileText size={13} aria-hidden="true" />
                              {resultDownloadingKey === key ? "…" : "Reçu"}
                            </button>

                            <a
                              href={whatsAppUrl(
                                buildWhatsAppMessage({
                                  firstName: member.firstName,
                                  month: monthLabel(row.month),
                                  year: row.year,
                                  amount: money(row.contribution.amountPaid),
                                  matricule: memberMatricule(member),
                                  date: formatDateTime(row.contribution.paidAt),
                                  reference: row.reference,
                                })
                              )}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <MessageCircle size={13} aria-hidden="true" />
                              WhatsApp
                            </a>
                          </>
                        )}
                      </div>
                    ) : (
                      <span className="admin-social-contributions__new-result-reason">
                        {row.reason ?? "Refusé"}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            <button type="button" className="admin-social-contributions__new-done" onClick={onDone}>
              Terminer
            </button>
          </div>
        )}
      </div>
    </AdminModal>
  );
};

export default SocialContributionsAdmin;
