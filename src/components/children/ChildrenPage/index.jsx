import { Link } from "react-router-dom";

import { ChevronRight } from "lucide-react";

import "./ChildrenPage.scss";

/**
 * Gabarit commun à tous les écrans du module Enfants.
 *
 * Les maquettes répètent la même structure douze fois : titre + fil
 * d'Ariane + action principale, une bande de cartes de statistiques,
 * une barre de filtres, un tableau, et une colonne latérale d'appoint.
 * La recopier à chaque écran garantirait qu'ils divergent au premier
 * ajustement d'espacement.
 *
 * Aucune donnée n'est chargée ici : ce composant ne fait que placer
 * ce qu'on lui donne.
 */
const ChildrenPage = ({
  title,
  breadcrumb = [],
  action,
  stats,
  filters,
  children,
  aside,
}) => (
  <div className="children-page">
    <header className="children-page__head">
      <div>
        <h1>{title}</h1>

        {breadcrumb.length > 0 && (
          <nav
            className="children-page__crumbs"
            aria-label="Fil d'Ariane"
          >
            {breadcrumb.map((crumb, index) => (
              <span key={crumb.label}>
                {crumb.to ? (
                  <Link to={crumb.to}>{crumb.label}</Link>
                ) : (
                  <span aria-current="page">{crumb.label}</span>
                )}

                {index < breadcrumb.length - 1 && (
                  <ChevronRight aria-hidden="true" />
                )}
              </span>
            ))}
          </nav>
        )}
      </div>

      {action && <div className="children-page__action">{action}</div>}
    </header>

    {stats && <div className="children-page__stats">{stats}</div>}

    {filters && <div className="children-page__filters">{filters}</div>}

    <div
      className={
        aside ? "children-page__body children-page__body--split" : "children-page__body"
      }
    >
      <div className="children-page__main">{children}</div>

      {aside && <aside className="children-page__aside">{aside}</aside>}
    </div>
  </div>
);

/**
 * Carte de statistique — le motif « 124 / Enfants inscrits / +12 ce mois ».
 *
 * `tone` colore uniquement la pastille d'icône. La valeur elle-même
 * reste à la couleur du texte : une grande valeur en couleur vive se
 * lit comme une alerte, alors que la plupart de ces chiffres sont
 * neutres.
 */
export const ChildrenStat = ({ icon: Icon, label, value, hint, tone = "neutral" }) => (
  <article className={`children-page__stat children-page__stat--${tone}`}>
    {Icon && (
      <span
        className="children-page__stat-icon"
        aria-hidden="true"
      >
        <Icon />
      </span>
    )}

    <div className="children-page__stat-body">
      <strong className="children-page__stat-value">{value}</strong>

      <span className="children-page__stat-label">{label}</span>

      {hint && <span className="children-page__stat-hint">{hint}</span>}
    </div>
  </article>
);

/** Encadré d'appoint de la colonne latérale. */
export const ChildrenPanel = ({ title, children, footer }) => (
  <section className="children-page__panel">
    {title && <h2 className="children-page__panel-title">{title}</h2>}

    {children}

    {footer && <div className="children-page__panel-foot">{footer}</div>}
  </section>
);

export default ChildrenPage;
