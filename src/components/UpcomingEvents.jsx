import { Link } from "react-router-dom";

import "./UpcomingEvents.scss";

import {
  FaCalendarAlt,
  FaClock,
  FaMapMarkerAlt,
  FaArrowRight,
} from "react-icons/fa";

import { eventsList } from "./EventDetails/data/events";

// Les données ne sont pas dupliquées ici : voir
// `src/components/EventDetails/data/events.js`.
const events = eventsList;

/**
 * Colonne de gauche de la page Événements : la liste « À venir ».
 * Le calendrier et les encarts vivent dans `EventsSidebar` ; la grille à
 * deux colonnes appartient à la page (`.events-layout`).
 */
const UpcomingEvents = () => {
  return (
    <section
      className="upcoming-events"
      aria-labelledby="upcoming-events-title"
    >
      <header className="upcoming-events__title">
        <div
          className="upcoming-events__title-icon"
          aria-hidden="true"
        >
          <FaCalendarAlt />
        </div>

        <div>
          <h2 id="upcoming-events-title">À venir</h2>
          <span aria-hidden="true" />
        </div>
      </header>

      <ul className="upcoming-events__list">
        {events.map((event) => (
          <li key={event.slug}>
            <Link
              className="upcoming-events__card"
              to={`/events/${event.slug}`}
              aria-label={`${event.title} — ${event.dateLong}. Voir le détail.`}
            >
              <div
                className="upcoming-events__date"
                aria-hidden="true"
              >
                <strong>{event.day}</strong>
                <span>{event.month}</span>
              </div>

              <div className="upcoming-events__image">
                <img
                  src={event.image}
                  alt={event.title}
                  loading="lazy"
                />
              </div>

              <div className="upcoming-events__content">
                <h3>{event.title}</h3>

                <p>{event.description}</p>

                <div className="upcoming-events__meta">
                  <span>
                    <FaClock aria-hidden="true" />
                    {event.time}
                  </span>

                  <span>
                    <FaMapMarkerAlt aria-hidden="true" />
                    {event.location}
                  </span>
                </div>
              </div>

              <span
                className="upcoming-events__arrow"
                aria-hidden="true"
              >
                <FaArrowRight />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default UpcomingEvents;
