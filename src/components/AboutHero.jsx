import { Link } from "react-router-dom";

import { motion } from "framer-motion";

import { HiArrowRight } from "react-icons/hi";
import { Clock } from "lucide-react";

import { site, dayLabel } from "../content/settings";

import "./AboutHero.scss";

import heroImage from "../assets/images/about-hero.jpg";

// Titre et boutons à gauche ; présentation et horaires à droite.
//
// Horaires réguliers, administrables (voir `content/settings.js`) : ils
// équilibrent la colonne de droite sans inventer de contenu.
const services = site.serviceTimes.slice(0, 2);

const AboutHero = () => {
  return (
    <section
      className="about-hero"
      style={{
        backgroundImage: `url(${heroImage})`,
      }}
    >
      <div
        className="about-hero__overlay"
        aria-hidden="true"
      ></div>

      <div className="about-hero__container">
        <motion.div
          className="about-hero__content"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="about-hero__main">
            <nav
              className="about-hero__breadcrumb"
              aria-label="Fil d'Ariane"
            >
              <Link to="/">Accueil</Link>

              <span aria-hidden="true">/</span>

              <span aria-current="page">À propos</span>
            </nav>

            <p className="about-hero__eyebrow">À propos de nous</p>

            <h1>
              Une église centrée sur Christ, pour{" "}
              <span className="about-hero__highlight">
                transformer des vies
              </span>{" "}
              et impacter notre génération.
            </h1>

            <div className="about-hero__actions">
              <a
                href="#vision"
                className="about-hero__cta"
              >
                Notre vision
                <HiArrowRight aria-hidden="true" />
              </a>

              <Link
                to="/ministries"
                className="about-hero__cta about-hero__cta--ghost"
              >
                Nos ministères
              </Link>
            </div>
          </div>

          <div className="about-hero__aside">
            <p className="about-hero__lead">
              Le Centre Apostolique Vie et Abondance est une église
              passionnée par la présence de Dieu et par l&apos;amour
              authentique manifesté en Jésus-Christ.
            </p>

            {services.length > 0 && (
              <ul
                className="about-hero__services"
                aria-label="Nos horaires"
              >
                {services.map((service) => (
                  <li key={`${service.label}-${service.day}`}>
                    <Clock size={16} aria-hidden="true" />

                    <span>
                      <strong>
                        {dayLabel(service.day)} · {service.time}
                      </strong>
                      {service.label}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default AboutHero;
