import { Link } from "react-router-dom";

import { FaArrowRight } from "react-icons/fa";

import { isPastEvent } from "../../utils/eventDates";

import "./EventCTA.scss";

// Appel final de la fiche événement. Pour un événement passé, inviter à
// « confirmer sa venue » n'aurait plus de sens : on renvoie vers l'agenda.
const EventCTA = ({ event }) => {
  const past = isPastEvent(event);

  return (
    <section
      className="event-cta"
      aria-labelledby="event-cta-title"
    >
      <div className="event-cta__container">
        <span className="event-cta__eyebrow">
          {past ? "Prochains rendez-vous" : "Participer"}
        </span>

        <h2 id="event-cta-title">
          {past
            ? "Ne manquez pas les prochains événements"
            : "Vous souhaitez participer ?"}
        </h2>

        <p>
          {past
            ? "Retrouvez tous les rendez-vous à venir de l'église dans l'agenda, ou abonnez-vous à la newsletter pour être prévenu."
            : `Écrivez-nous pour toute question sur « ${event.title} », pour confirmer votre venue ou pour vous impliquer dans l'organisation. Notre équipe vous répondra rapidement.`}
        </p>

        <div className="event-cta__actions">
          <Link
            to={past ? "/events" : "/contact"}
            className="event-cta__button"
          >
            {past ? "Voir l'agenda" : "Nous contacter"}
            <FaArrowRight aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default EventCTA;
