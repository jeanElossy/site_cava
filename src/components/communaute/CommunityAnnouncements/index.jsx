import { motion } from "framer-motion";

import {
  FaBullhorn,
  FaCalendarAlt,
  FaExclamationTriangle,
  FaThumbtack,
} from "react-icons/fa";

import { announcements } from "../../../services/api";

import useAsyncData from "../../../hooks/useAsyncData";

import "./CommunityAnnouncements.scss";

const CATEGORY_LABELS = {
  info: "Information",
  priere: "Prière",
  evenement: "Événement",
  service: "Service",
};

const formatDate = (value) => {
  if (!value) return null;

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const CommunityAnnouncements = () => {
  // `announcements.list` est une référence stable de services/api.js.
  const { data, loading, error, reload } = useAsyncData(
    announcements.list
  );

  const items = data ?? [];

  // Les annonces épinglées remontent en tête, puis les plus récentes.
  const sorted = [...items].sort((a, b) => {
    if (Boolean(b.pinned) !== Boolean(a.pinned)) {
      return Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    }

    return (b.date ?? b.createdAt ?? "").localeCompare(
      a.date ?? a.createdAt ?? ""
    );
  });

  return (
    <section className="community-news">
      <div className="community-news__container">
        <header className="community-news__header">
          <span className="community-news__eyebrow">
            Annonces de la communauté
          </span>

          <h2>Les nouvelles de la maison</h2>

          <div
            className="community-news__line"
            aria-hidden="true"
          ></div>

          <p>
            Retrouvez ici les informations pratiques, les sujets de prière et
            les rendez-vous partagés avec l&apos;ensemble de la communauté.
          </p>
        </header>

        <div
          className="community-news__body"
          aria-live="polite"
          aria-busy={loading}
        >
          {loading && (
            <ul className="community-news__grid">
              {[0, 1, 2].map((key) => (
                <li
                  key={key}
                  className="community-news__skeleton"
                >
                  <span className="sr-only">
                    Chargement des annonces…
                  </span>
                </li>
              ))}
            </ul>
          )}

          {!loading && error && (
            <div
              className="community-news__state community-news__state--error"
              role="alert"
            >
              <FaExclamationTriangle aria-hidden="true" />

              <p>{error}</p>

              <button
                type="button"
                onClick={reload}
              >
                Réessayer
              </button>
            </div>
          )}

          {!loading && !error && sorted.length === 0 && (
            <div className="community-news__state">
              <FaBullhorn aria-hidden="true" />

              <p>
                Aucune annonce publiée pour le moment. Les prochaines
                nouvelles de la communauté apparaîtront ici.
              </p>
            </div>
          )}

          {!loading && !error && sorted.length > 0 && (
            <ul className="community-news__grid">
              {sorted.map((item, index) => (
                <motion.li
                  key={item.id}
                  className={`community-news__card${
                    item.pinned ? " community-news__card--pinned" : ""
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{
                    duration: 0.4,
                    delay: Math.min(index, 5) * 0.06,
                  }}
                >
                  <div className="community-news__card-top">
                    <span className="community-news__tag">
                      {CATEGORY_LABELS[item.category] ?? "Information"}
                    </span>

                    {item.pinned && (
                      <span
                        className="community-news__pin"
                        title="Annonce épinglée"
                      >
                        <FaThumbtack aria-hidden="true" />

                        <span className="sr-only">Annonce épinglée</span>
                      </span>
                    )}
                  </div>

                  <h3>{item.title}</h3>

                  {item.body && (
                    <p className="community-news__text">{item.body}</p>
                  )}

                  {formatDate(item.date ?? item.createdAt) && (
                    <p className="community-news__date">
                      <FaCalendarAlt aria-hidden="true" />

                      <time
                        dateTime={item.date ?? item.createdAt}
                      >
                        {formatDate(item.date ?? item.createdAt)}
                      </time>
                    </p>
                  )}
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};

export default CommunityAnnouncements;
