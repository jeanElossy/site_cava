import { Link } from "react-router-dom";

import "./EventsHero.scss";

import heroImage from "../assets/images/events-hero.jpg";

const EventsHero = () => {
  return (
    <section
      className="events-hero"
      style={{
        backgroundImage: `url(${heroImage})`,
      }}
    >
      <div className="events-hero__overlay" />

      <div className="events-hero__container">

        <div className="events-hero__content">

          <nav
            className="events-hero__breadcrumb"
            aria-label="Fil d'Ariane"
          >
            <Link to="/">Accueil</Link>

            <span aria-hidden="true">/</span>

            <span aria-current="page">Événements</span>
          </nav>

          <h1>Événements</h1>

          <div className="events-hero__line" />

          <p>
            Participez à nos événements et vivez des
            moments d’édification, de communion
            et d’impact.
          </p>

        </div>

      </div>
    </section>
  );
};

export default EventsHero;