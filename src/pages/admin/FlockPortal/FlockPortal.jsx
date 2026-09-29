import { useEffect, useState } from "react";
import { Users, UserPlus, UserMinus, Phone, Home, Sparkles } from "lucide-react";

import { flockPortal } from "../../../services/api";
import usePageMeta from "../../../hooks/usePageMeta";
import useAsyncData from "../../../hooks/useAsyncData";
import { formatRegistrationNumber } from "../../../utils/registrationNumber";

import "./FlockPortal.scss";

const PAGE_SIZE = 25;

const displayName = (member) =>
  `${(member.lastName ?? "").toUpperCase()} ${
    member.firstName ?? ""
  }`.trim() || "—";

// Le matricule est stocké sans séparateur (`1ME19016P`) et se lit
// espacé (`1ME 19-016 P`) : la mise en forme passe par l'utilitaire
// commun, miroir frontend de celui de l'API.
const displayRegistration = (member) =>
  member.registrationNumber
    ? formatRegistrationNumber(member.registrationNumber)
    : "—";

const FlockPortal = () => {
  usePageMeta({
    title: "Ma bergerie — Administration",
    description: "Suivi des membres de votre bergerie.",
  });

  const { data: summary, error: summaryError } = useAsyncData(
    flockPortal.summary
  );

  const [page, setPage] = useState(1);
  const [members, setMembers] = useState([]);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    flockPortal
      .members({ page, limit: PAGE_SIZE })
      .then(({ items, meta: pageMeta }) => {
        if (!alive) return;

        setMembers(items ?? []);
        setMeta(pageMeta ?? null);
        setError("");
      })
      .catch((caught) => {
        if (!alive) return;

        setError(
          caught?.message ?? "La liste des membres n'a pas pu être chargée."
        );
      })
      .finally(() => {
        if (alive) setIsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [page]);

  // L'API refuse l'accès à un compte sans bergerie active : le message
  // du serveur est affiché tel quel, il dit précisément quoi faire
  // (« contactez l'administration ») là où un écran vide ne dirait
  // rien.
  if (summaryError) {
    return (
      <div className="flock-portal">
        <p className="flock-portal__alert" role="alert">
          {summaryError}
        </p>
      </div>
    );
  }

  const nouveaux = summary?.nouveaux ?? [];

  const stats = [
    { icon: Users, label: "Membres actifs", value: summary?.actifs },
    {
      icon: UserPlus,
      label: `Arrivées (${summary?.recentDays ?? 30} derniers jours)`,
      value: nouveaux.length,
    },
    { icon: UserMinus, label: "Désactivés", value: summary?.inactifs },
  ];

  return (
    <div className="flock-portal">
      <header className="flock-portal__header">
        <p className="flock-portal__eyebrow">Ma bergerie</p>

        <h1 className="flock-portal__title">
          {summary?.flock?.name ?? "Chargement…"}
        </h1>

        {summary?.flock?.code && (
          <p className="flock-portal__subtitle">
            Code {summary.flock.code} · Église {summary.flock.church}
          </p>
        )}
      </header>

      <ul className="flock-portal__stats">
        {stats.map((stat) => (
          <li key={stat.label} className="flock-portal__stat">
            <span className="flock-portal__stat-icon" aria-hidden="true">
              <stat.icon size={20} />
            </span>

            <span className="flock-portal__stat-body">
              {/* `?? "—"` et non `|| "—"` : zéro membre actif est une
                  information, pas une absence de donnée. */}
              <strong>{stat.value ?? "—"}</strong>
              {stat.label}
            </span>
          </li>
        ))}
      </ul>

      {/* Les arrivées récentes en tête, et pas seulement un compteur :
          c'est le chemin FIABLE pour apprendre qu'un nouveau membre a
          été affecté. La notification push, elle, suppose que le
          responsable ait installé le site sur son téléphone et accepté
          les notifications — ce qui peut ne jamais arriver. */}
      {nouveaux.length > 0 && (
        <section className="flock-portal__panel flock-portal__panel--new">
          <div className="flock-portal__panel-head">
            <h2>
              <Sparkles size={18} aria-hidden="true" />
              Nouvelles arrivées
            </h2>

            <p className="flock-portal__count">
              {summary.recentDays} derniers jours
            </p>
          </div>

          <ul className="flock-portal__new-list">
            {nouveaux.map((member) => (
              <li key={member._id ?? member.registrationNumber}>
                <span className="flock-portal__new-name">
                  {displayName(member)}
                </span>

                <span className="flock-portal__new-meta">
                  {displayRegistration(member)}
                  {member.joinedAt &&
                    ` · arrivé(e) le ${new Date(
                      member.joinedAt
                    ).toLocaleDateString("fr-FR")}`}
                </span>

                {member.phone && (
                  <a href={`tel:${member.phone}`}>
                    <Phone size={14} aria-hidden="true" />
                    {member.phone}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flock-portal__panel">
        <div className="flock-portal__panel-head">
          <h2>Membres de la bergerie</h2>

          {meta?.total != null && (
            <p className="flock-portal__count">
              {meta.total} membre{meta.total > 1 ? "s" : ""} actif
              {meta.total > 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Dit explicitement que la consultation est la seule action
            possible : sans cette phrase, l'absence de bouton se lit
            comme un écran inachevé. */}
        <p className="flock-portal__note">
          Cette liste est en consultation. Pour corriger une fiche,
          adressez-vous à l&apos;administration.
        </p>

        {isLoading && <p className="flock-portal__state">Chargement…</p>}

        {!isLoading && error && (
          <p className="flock-portal__alert" role="alert">
            {error}
          </p>
        )}

        {!isLoading && !error && members.length === 0 && (
          <p className="flock-portal__state">
            Aucun membre actif dans cette bergerie pour le moment.
          </p>
        )}

        {members.length > 0 && (
          <div className="flock-portal__table-wrap">
            <table className="flock-portal__table">
              <thead>
                <tr>
                  <th scope="col">Matricule</th>
                  <th scope="col">Nom &amp; prénoms</th>
                  <th scope="col">Téléphone</th>
                  <th scope="col">Quartier</th>
                </tr>
              </thead>

              <tbody>
                {members.map((member) => (
                  <tr key={member._id ?? member.id}>
                    <td data-label="Matricule">
                      {displayRegistration(member)}
                    </td>

                    <td data-label="Nom &amp; prénoms">
                      {displayName(member)}
                    </td>

                    <td data-label="Téléphone">
                      {member.phone ? (
                        // Un lien `tel:` : le portail se consulte au
                        // téléphone, appeler doit tenir en un geste.
                        <a href={`tel:${member.phone}`}>
                          <Phone size={14} aria-hidden="true" />
                          {member.phone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td data-label="Quartier">
                      {member.area ? (
                        <>
                          <Home size={14} aria-hidden="true" />
                          {member.area}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.pages > 1 && (
          <nav className="flock-portal__pager" aria-label="Pagination">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
            >
              Précédent
            </button>

            <span>
              Page {meta.page} sur {meta.pages}
            </span>

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(p + 1, meta.pages))}
              disabled={page >= meta.pages}
            >
              Suivant
            </button>
          </nav>
        )}
      </section>
    </div>
  );
};

export default FlockPortal;
