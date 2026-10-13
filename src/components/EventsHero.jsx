import { Link } from "react-router-dom";

import { motion } from "framer-motion";

import { HiArrowRight } from "react-icons/hi";

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
      <div
        className="events-hero__overlay"
        aria-hidden="true"
      />

      <div className="events-hero__container">
        <motion.div
          className="events-hero__content"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <nav
            className="events-hero__breadcrumb"
            aria-label="Fil d'Ariane"
          >
            <Link to="/">Accueil</Link>

            <span aria-hidden="true">/</span>

            <span aria-current="page">Événements</span>
          </nav>

          <p className="events-hero__eyebrow">Agenda</p>

          <h1>
            Nos <span className="events-hero__highlight">événements</span>
          </h1>

          <p className="events-hero__lead">
            Participez à nos événements et vivez des moments
            d&apos;édification, de communion et d&apos;impact.
          </p>

          <div className="events-hero__actions">
            <a
              href="#agenda"
              className="events-hero__cta"
            >
              Voir l&apos;agenda
              <HiArrowRight aria-hidden="true" />
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default EventsHero;
