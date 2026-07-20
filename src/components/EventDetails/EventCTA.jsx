import { Link } from "react-router-dom";

import { FaEnvelope } from "react-icons/fa";

import "./EventCTA.scss";

const EventCTA = ({ event }) => {
  return (
    <section className="event-cta">
      <div className="event-cta__overlay" aria-hidden="true" />

      <div className="event-cta__container">
        <h2>Vous souhaitez participer ?</h2>

        <p>
          Écrivez-nous pour toute question sur « {event.title} », pour
          confirmer votre venue ou pour vous impliquer dans
          l'organisation. Notre équipe vous répondra rapidement.
        </p>

        <Link to="/contact" className="event-cta__button">
          Nous contacter
          <FaEnvelope aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
};

export default EventCTA;
