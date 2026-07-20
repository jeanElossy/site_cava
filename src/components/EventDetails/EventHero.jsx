import { Link } from "react-router-dom";

import {
  FaRegCalendarAlt,
  FaRegClock,
  FaMapMarkerAlt,
  FaEnvelope,
} from "react-icons/fa";

import "./EventHero.scss";

const EventHero = ({ event }) => {
  return (
    <section className="event-hero">
      <img
        src={event.image}
        alt={event.title}
        className="event-hero__image"
      />

      <div className="event-hero__overlay" aria-hidden="true" />

      <div className="event-hero__content">
        <span className="event-hero__badge">Événement</span>

        <h1 className="event-hero__title">{event.title}</h1>

        <p className="event-hero__description">{event.description}</p>

        <ul className="event-hero__meta">
          <li>
            <FaRegCalendarAlt aria-hidden="true" />

            <span className="sr-only">Date :</span>
            {event.date}
          </li>

          <li>
            <FaRegClock aria-hidden="true" />

            <span className="sr-only">Horaire :</span>
            {event.endTime
              ? `${event.time} - ${event.endTime}`
              : event.time}
          </li>

          <li>
            <FaMapMarkerAlt aria-hidden="true" />

            <span className="sr-only">Lieu :</span>
            {event.location}
          </li>
        </ul>

        <div className="event-hero__actions">
          <Link to="/contact" className="event-hero__btn-primary">
            <FaEnvelope aria-hidden="true" />
            Je participe
          </Link>

          <Link to="/events" className="event-hero__btn-outline">
            Tous les événements
          </Link>
        </div>
      </div>
    </section>
  );
};

export default EventHero;
