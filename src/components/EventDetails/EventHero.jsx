import { Link } from "react-router-dom";

import { motion } from "framer-motion";

import {
  FaArrowRight,
  FaHistory,
  FaMapMarkerAlt,
  FaRegCalendarAlt,
  FaRegClock,
} from "react-icons/fa";

import { eventDateLabel, isPastEvent } from "../../utils/eventDates";

import "./EventHero.scss";

const EventHero = ({ event }) => {
  const past = isPastEvent(event);

  const date = eventDateLabel(event);

  const time = event.endTime ? `${event.time} - ${event.endTime}` : event.time;

  return (
    <section
      className="event-hero"
      style={
        event.image ? { backgroundImage: `url(${event.image})` } : undefined
      }
    >
      <div
        className="event-hero__overlay"
        aria-hidden="true"
      />

      <div className="event-hero__container">
        <motion.div
          className="event-hero__content"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <nav
            className="event-hero__breadcrumb"
            aria-label="Fil d'Ariane"
          >
            <Link to="/">Accueil</Link>

            <span aria-hidden="true">/</span>

            <Link to="/events">Événements</Link>

            <span aria-hidden="true">/</span>

            <span aria-current="page">{event.title}</span>
          </nav>

          <p className="event-hero__eyebrow">
            {past ? "Événement passé" : "Événement"}
          </p>

          <h1 className="event-hero__title">{event.title}</h1>

          {event.description && (
            <p className="event-hero__description">{event.description}</p>
          )}

          <ul className="event-hero__meta">
            {date && (
              <li>
                <FaRegCalendarAlt aria-hidden="true" />
                <span className="sr-only">Date :</span>
                {date}
              </li>
            )}

            {time && (
              <li>
                <FaRegClock aria-hidden="true" />
                <span className="sr-only">Horaire :</span>
                {time}
              </li>
            )}

            {event.location && (
              <li>
                <FaMapMarkerAlt aria-hidden="true" />
                <span className="sr-only">Lieu :</span>
                {event.location}
              </li>
            )}
          </ul>

          {past && (
            <p className="event-hero__past">
              <FaHistory aria-hidden="true" />
              Cet événement a eu lieu. Retrouvez les prochains rendez-vous
              dans l&apos;agenda.
            </p>
          )}

          <div className="event-hero__actions">
            {past ? (
              <Link
                to="/events"
                className="event-hero__cta"
              >
                Voir l&apos;agenda
                <FaArrowRight aria-hidden="true" />
              </Link>
            ) : (
              <>
                <Link
                  to="/contact"
                  className="event-hero__cta"
                >
                  Je participe
                  <FaArrowRight aria-hidden="true" />
                </Link>

                <Link
                  to="/events"
                  className="event-hero__cta event-hero__cta--ghost"
                >
                  Tous les événements
                </Link>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default EventHero;
