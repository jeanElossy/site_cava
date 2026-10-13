import { motion } from "framer-motion";

import { Link } from "react-router-dom";

import { ArrowRight, Heart, MapPin, Phone } from "lucide-react";

import { site, dayLabel, telHref } from "../../content/settings";

import "./HomeVisit.scss";

// Dernière section de l'accueil : où et quand venir. Horaires, adresse
// et téléphone viennent des paramètres du site (administrables), comme
// dans le pied de page et la page Contact.
const HomeVisit = () => {
  return (
    <section
      className="home-visit"
      aria-labelledby="home-visit-title"
    >
      <div className="home-visit__container">
        <div className="home-visit__intro">
          <span className="home-visit__eyebrow">Venez nous voir</span>

          <h2 id="home-visit-title">
            Une place vous attend parmi nous
          </h2>

          <p>
            Que vous cherchiez une église, que vous soyez de passage à
            Abidjan ou simplement curieux, vous serez accueilli comme un
            membre de la famille.
          </p>

          <ul className="home-visit__contact">
            <li>
              <MapPin size={18} aria-hidden="true" />
              <span>{site.address.trim()}</span>
            </li>

            <li>
              <Phone size={18} aria-hidden="true" />
              <a href={telHref(site.phonePrimary)}>{site.phonePrimary}</a>
            </li>
          </ul>

          <div className="home-visit__actions">
            <Link
              to="/contact"
              className="home-visit__cta"
            >
              Préparer ma visite
              <ArrowRight size={18} aria-hidden="true" />
            </Link>

            <Link
              to="/donate"
              className="home-visit__cta home-visit__cta--ghost"
            >
              Soutenir l&apos;œuvre
              <Heart size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <motion.ul
          className="home-visit__times"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {site.serviceTimes.map((service) => (
            <li key={`${service.label}-${service.day}`}>
              <span className="home-visit__day">
                {dayLabel(service.day)}
              </span>

              <div>
                <h3>{service.label}</h3>

                {service.description && <p>{service.description}</p>}
              </div>

              <span className="home-visit__time">{service.time}</span>
            </li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
};

export default HomeVisit;
