import { Link } from "react-router-dom";

import { motion } from "framer-motion";

import { HiArrowRight } from "react-icons/hi";

import "./ContactHero.scss";

import heroImage from "../assets/images/contact-hero.jpg";

const ContactHero = () => {
  return (
    <section
      className="contact-hero"
      style={{
        backgroundImage: `url(${heroImage})`,
      }}
    >
      <div
        className="contact-hero__overlay"
        aria-hidden="true"
      />

      <div className="contact-hero__container">
        <motion.div
          className="contact-hero__content"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <nav
            className="contact-hero__breadcrumb"
            aria-label="Fil d'Ariane"
          >
            <Link to="/">Accueil</Link>

            <span aria-hidden="true">/</span>

            <span aria-current="page">Contact</span>
          </nav>

          <p className="contact-hero__eyebrow">Parlons ensemble</p>

          <h1>
            Contactez-<span className="contact-hero__highlight">nous</span>
          </h1>

          <p className="contact-hero__lead">
            Nous serions heureux de vous entendre et de vous accompagner dans
            votre cheminement avec Christ.
          </p>

          <div className="contact-hero__actions">
            <a
              href="#contact-formulaire"
              className="contact-hero__cta"
            >
              Écrire un message
              <HiArrowRight aria-hidden="true" />
            </a>

            <a
              href="#horaires"
              className="contact-hero__cta contact-hero__cta--ghost"
            >
              Horaires des cultes
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default ContactHero;
