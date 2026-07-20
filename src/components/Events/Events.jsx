import {
  Calendar,
  ChevronRight,
  ArrowRight,
} from "lucide-react";

import { Link } from "react-router-dom";

import { eventsList } from "../EventDetails/data/events";

import "./Events.scss";

// L'accueil affiche les 3 premiers événements de la source unique.
// Les données ne sont plus dupliquées ici : voir
// `src/components/EventDetails/data/events.js`.
const events = eventsList.slice(0, 3);

const Events = () => {
  return (
    <div className="events-card">

      <div className="events-header">
        <Calendar size={20} aria-hidden="true" />
        <h3>PROCHAINS ÉVÉNEMENTS</h3>
      </div>

      <div className="events-list">
        {events.map((event) => (
          <Link
            to={`/events/${event.slug}`}
            className="event"
            key={event.slug}
            aria-label={`${event.title} — ${event.dateLong}. Voir le détail.`}
          >
            <div
              className={`event-date ${event.color}`}
              aria-hidden="true"
            >
              <span>{event.day}</span>
              <small>{event.month}</small>
            </div>

            <div className="event-content">
              <h4>{event.title}</h4>

              <p>{event.dateLong}</p>

              {/*
                Visuel de l'événement avec sa description en surimpression.
                Le dégradé sombre garantit le contraste du texte quelle que
                soit l'image.
              */}
              <div className="event-media">
                <img
                  src={event.image}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  decoding="async"
                />

                <span className="event-media__text">
                  {event.description}
                </span>
              </div>
            </div>

            <ChevronRight size={20} aria-hidden="true" />
          </Link>
        ))}
      </div>

      <Link
        to="/events"
        className="events-link"
      >
        Voir tous les événements
        <ArrowRight size={18} aria-hidden="true" />
      </Link>

    </div>
  );
};

export default Events;
