import { motion } from "framer-motion";

import {
  ArrowRight,
  CalendarDays,
  Clock,
  MapPin,
} from "lucide-react";

import { Link } from "react-router-dom";

import { eventsList } from "../EventDetails/data/events";

import { upcomingEvents } from "../../utils/eventDates";

import "./Events.scss";

// L'accueil affiche les 3 prochains événements de la source unique
// (`src/components/EventDetails/data/events.js`).
//
// Il prenait auparavant les trois PREMIERS de la liste, passés ou non :
// mi-octobre, la rubrique « Prochains événements » annonçait encore des
// rendez-vous d'août. Le calcul se fait au rendu, pas au build : un site
// publié il y a un mois ne doit pas continuer d'annoncer ce qui est
// passé depuis.
const Events = () => {
  const events = upcomingEvents(eventsList, new Date(), 3);

  return (
    <section
      className="home-events"
      aria-labelledby="home-events-title"
    >
      <div className="home-events__container">
        <header className="home-events__header">
          <div>
            <span className="home-events__eyebrow">Agenda</span>

            <h2 id="home-events-title">Prochains événements</h2>
          </div>

          <Link
            to="/events"
            className="home-events__all"
          >
            Voir tout l&apos;agenda
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </header>

        {events.length === 0 ? (
          <div className="home-events__empty">
            <CalendarDays size={30} aria-hidden="true" />

            <div>
              <h3>Aucun événement programmé pour le moment</h3>

              <p>
                Les prochains rendez-vous seront annoncés ici. En attendant,
                nos cultes réguliers vous accueillent chaque semaine.
              </p>
            </div>

            <Link to="/contact">Nous rendre visite</Link>
          </div>
        ) : (
          <ul className="home-events__grid">
            {events.map((event, index) => (
              <motion.li
                key={event.slug}
                className="home-events__card"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.45, delay: index * 0.08 }}
              >
                <Link
                  to={`/events/${event.slug}`}
                  className="home-events__link"
                >
                  <div className="home-events__media">
                    {event.image && (
                      <img
                        src={event.image}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                    )}

                    <span
                      className="home-events__date"
                      aria-hidden="true"
                    >
                      <span>{event.day}</span>
                      <small>{event.month}</small>
                    </span>
                  </div>

                  <div className="home-events__body">
                    <h3>{event.title}</h3>

                    {event.description && <p>{event.description}</p>}

                    <ul className="home-events__meta">
                      <li>
                        <Clock size={15} aria-hidden="true" />
                        {event.dateLong}
                      </li>

                      {event.location && (
                        <li>
                          <MapPin size={15} aria-hidden="true" />
                          {event.location}
                        </li>
                      )}
                    </ul>

                    <span className="home-events__more">
                      Voir le détail
                      <ArrowRight size={16} aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default Events;
