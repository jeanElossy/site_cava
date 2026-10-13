import { ArrowRight, CalendarDays, Clock, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

import { site, dayLabel } from "../../content/settings";

import heroBg from "../../assets/images/hero-bg.jpg";
import logoCava from "../../assets/logo/logo_cava.gif";

import "./Hero.scss";

// Les trois premiers horaires réguliers : c'est la première question
// d'un visiteur (« quand venir ? »), elle mérite d'être visible sans
// défiler. Ils viennent des paramètres du site, administrables.
const services = site.serviceTimes.slice(0, 3);

const Hero = () => {
  return (
    <section
      className="hero"
      style={{
        backgroundImage: `url(${heroBg})`,
      }}
    >
      <div
        className="hero__overlay"
        aria-hidden="true"
      ></div>

      <div className="hero__container">
        <motion.div
          className="hero__content"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <p className="hero__eyebrow">Bienvenue au</p>

          <h1>
            Centre Apostolique{" "}
            <span className="hero__highlight">Vie et Abondance</span>
          </h1>

          <p className="hero__lead">
            Une église qui communique la vie abondante de Dieu par la
            Parole et par le Saint-Esprit.
          </p>

          <div className="hero__actions">
            <Link
              to="/about"
              className="hero__cta"
            >
              Nous découvrir
              <ArrowRight size={18} aria-hidden="true" />
            </Link>

            <Link
              to="/events"
              className="hero__cta hero__cta--ghost"
            >
              Nos rendez-vous
              <CalendarDays size={18} aria-hidden="true" />
            </Link>
          </div>
        </motion.div>

        <motion.img
          src={logoCava}
          alt=""
          aria-hidden="true"
          className="hero__logo"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
        />
      </div>

      {services.length > 0 && (
        <div className="hero__services">
          <div className="hero__services-inner">
            <h2 className="hero__services-title">
              <Clock size={18} aria-hidden="true" />
              Nos horaires
            </h2>

            <ul className="hero__services-list">
              {services.map((service) => (
                <li key={`${service.label}-${service.day}`}>
                  <span className="hero__service-day">
                    {dayLabel(service.day)} · {service.time}
                  </span>

                  <span className="hero__service-label">
                    {service.label}
                  </span>
                </li>
              ))}
            </ul>

            <p className="hero__services-address">
              <MapPin size={16} aria-hidden="true" />
              {site.address.trim()}
            </p>
          </div>
        </div>
      )}
    </section>
  );
};

export default Hero;
