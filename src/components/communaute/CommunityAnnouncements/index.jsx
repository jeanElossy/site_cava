import { useId, useState } from "react";

import { motion } from "framer-motion";

import {
  FaBullhorn,
  FaChevronDown,
  FaExclamationTriangle,
  FaThumbtack,
} from "react-icons/fa";

import { announcements } from "../../../services/api";

import useAsyncData from "../../../hooks/useAsyncData";

import {
  parseInline,
  parseRichText,
  toPlainText,
} from "../../../utils/richText";

import "./CommunityAnnouncements.scss";

const CATEGORY_LABELS = {
  info: "Information",
  priere: "Prière",
  evenement: "Événement",
  service: "Service",
};

// Au-delà de cette longueur, l'aperçu est tronqué et un bouton permet
// de lire l'annonce entière. En dessous, tout tient dans la carte.
const EXCERPT_THRESHOLD = 280;

// Date de référence d'une annonce : sa publication, à défaut sa
// création. `date` est conservé pour les anciennes fiches.
const dateOf = (item) =>
  item.publishedAt ?? item.date ?? item.createdAt ?? null;

const parseDate = (value) => {
  if (!value) return null;

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

// Texte saisi dans l'administration → éléments React. Aucun HTML n'est
// injecté (voir utils/richText.js) : le contenu reste du texte.
const Inline = ({ text }) =>
  parseInline(text).map((segment, index) => {
    if (segment.strong) return <strong key={index}>{segment.text}</strong>;
    if (segment.em) return <em key={index}>{segment.text}</em>;
    return <span key={index}>{segment.text}</span>;
  });

const RichText = ({ text }) =>
  parseRichText(text).map((block, index) => {
    if (block.type === "heading") {
      return (
        <h4 key={index}>
          <Inline text={block.text} />
        </h4>
      );
    }

    if (block.type === "list") {
      return (
        <ul key={index}>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>
              <Inline text={item} />
            </li>
          ))}
        </ul>
      );
    }

    return (
      <p key={index}>
        <Inline text={block.text} />
      </p>
    );
  });

const AnnouncementCard = ({ item, index }) => {
  const [open, setOpen] = useState(false);

  const bodyId = useId();

  const date = parseDate(dateOf(item));

  const plain = toPlainText(item.body);

  const long = plain.length > EXCERPT_THRESHOLD;

  return (
    <motion.li
      className={`community-news__card${
        item.pinned ? " community-news__card--pinned" : ""
      }`}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{
        duration: 0.4,
        delay: Math.min(index, 5) * 0.06,
      }}
    >
      <article>
        {date && (
          <time
            className="community-news__date"
            dateTime={date.toISOString()}
          >
            <span className="community-news__date-day">
              {date.toLocaleDateString("fr-FR", { day: "2-digit" })}
            </span>

            <span className="community-news__date-month">
              {date.toLocaleDateString("fr-FR", { month: "short" })}
            </span>

            <span className="community-news__date-year">
              {date.getFullYear()}
            </span>
          </time>
        )}

        <div className="community-news__content">
          <div className="community-news__card-top">
            <span className="community-news__tag">
              {CATEGORY_LABELS[item.category] ?? "Information"}
            </span>

            {item.pinned && (
              <span className="community-news__pin">
                <FaThumbtack aria-hidden="true" />
                Épinglée
              </span>
            )}
          </div>

          <h3>{item.title}</h3>

          {plain && (
            <>
              {/* Aperçu : texte brut tronqué, masqué une fois déplié. */}
              {!open && (
                <p
                  className={`community-news__excerpt${
                    long ? " community-news__excerpt--clamped" : ""
                  }`}
                >
                  {plain}
                </p>
              )}

              {long && (
                <div
                  id={bodyId}
                  className="community-news__body"
                  hidden={!open}
                >
                  {open && <RichText text={item.body} />}
                </div>
              )}

              {long && (
                <button
                  type="button"
                  className="community-news__toggle"
                  aria-expanded={open}
                  aria-controls={bodyId}
                  onClick={() => setOpen((value) => !value)}
                >
                  {open ? "Réduire" : "Lire l'annonce complète"}
                  <FaChevronDown aria-hidden="true" />
                </button>
              )}
            </>
          )}
        </div>
      </article>
    </motion.li>
  );
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

    return String(dateOf(b) ?? "").localeCompare(String(dateOf(a) ?? ""));
  });

  return (
    <section
      className="community-news"
      aria-labelledby="community-news-title"
    >
      <div className="community-news__container">
        <header className="community-news__header">
          <span className="community-news__eyebrow">
            Annonces de la communauté
          </span>

          <h2 id="community-news-title">Les nouvelles de la maison</h2>

          <p>
            Informations pratiques, sujets de prière et rendez-vous
            partagés avec l&apos;ensemble de la communauté.
          </p>
        </header>

        <div
          className="community-news__list-wrapper"
          aria-live="polite"
          aria-busy={loading}
        >
          {loading && (
            <ul className="community-news__grid">
              {[0, 1].map((key) => (
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
                <AnnouncementCard
                  key={item.id}
                  item={item}
                  index={index}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};

export default CommunityAnnouncements;
