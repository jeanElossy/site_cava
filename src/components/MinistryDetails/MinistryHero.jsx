import { Link } from "react-router-dom";

import { motion } from "framer-motion";

import { FaArrowRight } from "react-icons/fa";

import "./MinistryHero.scss";

const MinistryHero = ({ ministry }) => {
  return (
    <section
      className="ministry-hero"
      style={
        ministry.image
          ? { backgroundImage: `url(${ministry.image})` }
          : undefined
      }
    >
      <div
        className="ministry-hero__overlay"
        aria-hidden="true"
      />

      <div className="ministry-hero__container">
        <motion.div
          className="ministry-hero__content"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <nav
            className="ministry-hero__breadcrumb"
            aria-label="Fil d'Ariane"
          >
            <Link to="/">Accueil</Link>

            <span aria-hidden="true">/</span>

            <Link to="/ministries">Ministères</Link>

            <span aria-hidden="true">/</span>

            <span aria-current="page">{ministry.title}</span>
          </nav>

          <p className="ministry-hero__eyebrow">Ministère</p>

          <h1 className="ministry-hero__title">{ministry.title}</h1>

          {ministry.description && (
            <p className="ministry-hero__description">
              {ministry.description}
            </p>
          )}

          <div className="ministry-hero__actions">
            <Link
              to="/contact"
              className="ministry-hero__cta"
            >
              Rejoindre le ministère
              <FaArrowRight aria-hidden="true" />
            </Link>

            <Link
              to="/ministries"
              className="ministry-hero__cta ministry-hero__cta--ghost"
            >
              Tous les ministères
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default MinistryHero;
