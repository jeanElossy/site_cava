import { Link } from "react-router-dom";

import { motion } from "framer-motion";

import {
  FaArrowRight,
  FaCalendarAlt,
  FaClock,
  FaHistory,
  FaMapMarkerAlt,
} from "react-icons/fa";

import { eventsList } from "./EventDetails/data/events";

import {
  eventStartDate,
  pastEvents,
  upcomingEvents,
} from "../utils/eventDates";

import "./UpcomingEvents.scss";

// Jour et mois courts calculés depuis la date réelle (« 02 / sept. ») :
// le mois en toutes lettres (« SEPTEMBRE ») débordait de la pastille.
const shortDate = (event) => {
  const date = eventStartDate(event);

  if (!date) return { day: event.day, month: event.month };

  return {
    day: date.toLocaleDateString("fr-FR", { day: "2-digit" }),
    month: date
      .toLocaleDateString("fr-FR", { month: "short" })
      .replace(".", ""),
  };
};

const EventCard = ({ event, past = false, index = 0 }) => {
  const { day, month } = shortDate(event);

  return (
    <motion.li
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4, delay: Math.min(index, 4) * 0.06 }}
    >
      <Link
        className={`upcoming-events__card${
          past ? " upcoming-events__card--past" : ""
        }`}
        to={`/events/${event.slug}`}
      >
        <div className="upcoming-events__media">
          {event.image && (
            <img
              src={event.image}
              alt=""
              loading="lazy"
              decoding="async"
            />
          )}

          <span
            className="upcoming-events__date"
            aria-hidden="true"
          >
            <strong>{day}</strong>
            <span>{month}</span>
          </span>
        </div>

        <div className="upcoming-events__content">
          {past && <span className="upcoming-events__past-tag">Passé</span>}

          <h3>{event.title}</h3>

          {event.description && <p>{event.description}</p>}

          <ul className="upcoming-events__meta">
            <li>
              <FaCalendarAlt aria-hidden="true" />
              {event.dateLong}
            </li>

            {event.location && (
              <li>
                <FaMapMarkerAlt aria-hidden="true" />
                {event.location}
              </li>
            )}
          </ul>

          <span className="upcoming-events__more">
            {past ? "Revoir l'événement" : "Voir le détail"}
            <FaArrowRight aria-hidden="true" />
          </span>
        </div>
      </Link>
    </motion.li>
  );
};

/**
 * Colonne de gauche de la page Événements : à venir, puis passés.
 * Le calendrier et les encarts vivent dans `EventsSidebar` ; la grille à
 * deux colonnes appartient à la page (`.events-layout`).
 *
 * Tous les événements étaient auparavant listés sous « À venir », passés
 * compris. Le tri se fait au rendu, pas au build.
 */
const UpcomingEvents = () => {
  const now = new Date();

  const upcoming = upcomingEvents(eventsList, now);
  const past = pastEvents(eventsList, now);

  return (
    <div className="upcoming-events">
      <section aria-labelledby="upcoming-events-title">
        <header className="upcoming-events__header">
          <span className="upcoming-events__eyebrow">Agenda</span>

          <h2 id="upcoming-events-title">À venir</h2>
        </header>

        {upcoming.length > 0 ? (
          <ul className="upcoming-events__list">
            {upcoming.map((event, index) => (
              <EventCard
                key={event.slug}
                event={event}
                index={index}
              />
            ))}
          </ul>
        ) : (
          <div className="upcoming-events__empty">
            <FaClock aria-hidden="true" />

            <div>
              <h3>Aucun événement programmé pour le moment</h3>

              <p>
                Les prochains rendez-vous seront annoncés ici et dans la
                newsletter. Nos cultes réguliers, eux, ont lieu chaque
                semaine.
              </p>
            </div>
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section
          className="upcoming-events__past"
          aria-labelledby="past-events-title"
        >
          <header className="upcoming-events__header">
            <h2 id="past-events-title">
              <FaHistory aria-hidden="true" />
              Événements passés
            </h2>
          </header>

          <ul className="upcoming-events__list">
            {past.map((event, index) => (
              <EventCard
                key={event.slug}
                event={event}
                index={index}
                past
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default UpcomingEvents;
