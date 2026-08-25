import { useCallback, useState } from "react";

import { MessageCircle, RefreshCw, Wand2 } from "lucide-react";

import {
  fetchSocialExercices,
  fetchUnpaidContributions,
  generateSocialContributions,
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
  flockLabel,
  memberMatricule,
  memberName,
  money,
  monthLabel,
  useChurchOptions,
} from "./socialShared";

import "./SocialArrearsAdmin.scss";

// Le rattrapage des lignes dues réécrit la base pour toute une église :
// réservé aux mêmes rôles que la configuration du module, comme côté
// serveur (SOCIAL_ADMIN_ROLES).
const canGenerate = () =>
  ["admin", "social_admin"].includes(currentUser()?.role);

// « De janvier 2024 à mars 2026 » plutôt que la liste des 27 mois : le
// détail complet noierait le tableau, alors que la borne basse est ce
// qui dit depuis quand le membre a décroché.
const rangeLabel = (months) => {
  if (months.length === 0) return "—";

  const first = months[0];
  const last = months[months.length - 1];

  const from = `${monthLabel(first.month).toLowerCase()} ${first.year}`;

  if (months.length === 1) return from;

  return `${from} → ${monthLabel(last.month).toLowerCase()} ${last.year}`;
};

// Le message part sans numéro cible : le format des numéros stockés
// n'est pas garanti fiable, l'agent choisit le contact dans WhatsApp —
// même règle que le reçu d'offrande (voir socialShared.js).
const reminderUrl = (row) =>
  `https://wa.me/?text=${encodeURIComponent(
    `Bonjour ${row.member?.firstName ?? ""},\n\n` +
      `Nous n'avons pas encore reçu votre offrande sociale pour ${row.monthsCount} mois ` +
      `(${rangeLabel(row.unpaidMonths)}).\n\n` +
      `Reste à régler : ${money(row.remaining)}\n` +
      `Matricule : ${memberMatricule(row.member)}\n\n` +
      "Merci de vous rapprocher du Service Social."
  )}`;

const SocialArrearsAdmin = () => {
  usePageMeta({
    title: "Service Social — Arriérés",
    description:
      "Membres dont les offrandes sociales restent dues, et montant cumulé à recouvrer.",
  });

  const { options: churchOptions } = useChurchOptions();

  const [church, setChurch] = useState("");
  const [year, setYear] = useState("");
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState("");
  const [generateError, setGenerateError] = useState("");

  // Les exercices d'une église donnent les années sur lesquelles il est
  // utile de filtrer. Sans église choisie (« toutes »), on n'en propose
  // aucune : les exercices sont par église.
  const loadExercices = useCallback(() => {
    if (!church) return Promise.resolve([]);

    return fetchSocialExercices({ church });
  }, [church]);

  const { data: exercices } = useAsyncData(loadExercices);

  const load = useCallback(
    () =>
      fetchUnpaidContributions({
        ...(church ? { church } : {}),
        ...(year ? { year } : {}),
      }),
    [church, year]
  );

  const { data, loading, error, reload } = useAsyncData(load);

  const rows = data ?? [];

  const totals = rows.reduce(
    (accumulator, row) => {
      accumulator.remaining += Number(row.remaining) || 0;
      accumulator.months += Number(row.monthsCount) || 0;

      return accumulator;
    },
    { remaining: 0, months: 0 }
  );

  const changeChurch = (value) => {
    setChurch(value);
    // Les exercices sont propres à une église : garder l'année d'une
    // autre église filtrerait sur une caisse qui n'existe pas ici.
    setYear("");
  };

  const runGeneration = async () => {
    setGenerating(true);
    setNotice("");
    setGenerateError("");

    try {
      const result = await generateSocialContributions(
        church ? { church: Number(church) } : {}
      );

      setNotice(
        result.created > 0
          ? `${result.created} ligne(s) d'offrande créée(s).`
          : "Aucune ligne manquante : tout est déjà à jour."
      );

      reload();
    } catch (caught) {
      setGenerateError(caught.message ?? "La génération a échoué.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="admin-social-arrears">
      <header className="admin-social-arrears__header">
        <div>
          <h1>Arriérés d&apos;offrandes</h1>
          <p>
            Membres dont des mois échus restent dus, et cumul restant à
            recouvrer. Les arriérés remontent à janvier 2024, ou au mois
            d&apos;arrivée du membre s&apos;il est postérieur. Le mois en cours
            n&apos;apparaît pas tant qu&apos;il n&apos;est pas écoulé.
          </p>
        </div>

        <div className="admin-social-arrears__header-actions">
          <label className="admin-social-arrears__select">
            <span>Église</span>
            <select
              value={church}
              onChange={(event) => changeChurch(event.target.value)}
            >
              <option value="">Toutes les églises</option>
              {churchOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-social-arrears__select">
            <span>Exercice</span>
            <select
              value={year}
              onChange={(event) => setYear(event.target.value)}
              disabled={!church}
            >
              <option value="">Toutes les années</option>
              {(exercices ?? []).map((item) => (
                <option key={item.year} value={item.year}>
                  {item.year}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="admin-social-arrears__refresh"
            onClick={reload}
          >
            <RefreshCw size={17} aria-hidden="true" />
            Actualiser
          </button>

          {canGenerate() && (
            <button
              type="button"
              className="admin-social-arrears__generate"
              onClick={runGeneration}
              disabled={generating}
            >
              <Wand2 size={17} aria-hidden="true" />
              {generating ? "Génération…" : "Générer les mois manquants"}
            </button>
          )}
        </div>
      </header>

      {notice && (
        <p className="admin-social-arrears__notice" role="status">
          {notice}
        </p>
      )}

      {generateError && (
        <p className="admin-social-arrears__alert" role="alert">
          {generateError}
        </p>
      )}

      {!loading && !error && rows.length > 0 && (
        <ul className="admin-social-arrears__totals">
          <li>
            <span>Membres concernés</span>
            <strong>{rows.length}</strong>
          </li>
          <li>
            <span>Mois impayés cumulés</span>
            <strong>{totals.months}</strong>
          </li>
          <li>
            <span>Reste à recouvrer</span>
            <strong>{money(totals.remaining)}</strong>
          </li>
        </ul>
      )}

      {loading && <AdminLoading label="Chargement des arriérés…" />}
      {error && <AdminError message={error} onRetry={reload} />}

      {!loading && !error && rows.length === 0 && (
        <AdminEmpty message="Aucun arriéré : tous les mois échus sont réglés ou exonérés. Si la liste vous paraît vide à tort, lancez « Générer les mois manquants »." />
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="admin-social-arrears__table-wrap">
          <table className="admin-social-arrears__table">
            <thead>
              <tr>
                <th scope="col">Matricule</th>
                <th scope="col">Nom</th>
                <th scope="col">Bergerie</th>
                <th scope="col">Mois dus</th>
                <th scope="col">Période</th>
                <th scope="col">Déjà versé</th>
                <th scope="col">Reste dû</th>
                <th scope="col">
                  <span className="sr-only">Relancer</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.member?.id ?? rangeLabel(row.unpaidMonths)}>
                  <td>{memberMatricule(row.member)}</td>
                  <td>{memberName(row.member)}</td>
                  <td>{flockLabel(row.member?.flock)}</td>
                  <td>
                    <span className="admin-social-arrears__count">
                      {row.monthsCount}
                    </span>
                  </td>
                  <td>{rangeLabel(row.unpaidMonths)}</td>
                  <td className="admin-social-arrears__amount">
                    {money(row.totalPaid)}
                  </td>
                  <td className="admin-social-arrears__amount admin-social-arrears__amount--due">
                    {money(row.remaining)}
                  </td>
                  <td>
                    <a
                      className="admin-social-arrears__whatsapp"
                      href={reminderUrl(row)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle size={14} aria-hidden="true" />
                      Relancer
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SocialArrearsAdmin;
