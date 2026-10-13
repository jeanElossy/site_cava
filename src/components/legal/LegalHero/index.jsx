import { motion } from "framer-motion";
import { Link } from "react-router-dom";

import "./LegalHero.scss";

import defaultImage from "../../../assets/images/bible.jpg";

// Héros des pages légales : hero commun du site (mixin `page-hero`),
// avec un sur-titre « Informations légales ».
const LegalHero = ({ title, intro, image = defaultImage }) => {
  return (
    <section
      className="legal-hero"
      style={{ backgroundImage: `url(${image})` }}
    >
      <div
        className="legal-hero__overlay"
        aria-hidden="true"
      />

      <div className="legal-hero__container">
        <motion.div
          className="legal-hero__content"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <nav
            className="legal-hero__breadcrumb"
            aria-label="Fil d'Ariane"
          >
            <Link to="/">Accueil</Link>

            <span aria-hidden="true">/</span>

            <span aria-current="page">{title}</span>
          </nav>

          <p className="legal-hero__eyebrow">Informations légales</p>

          <h1>{title}</h1>

          <p className="legal-hero__lead">{intro}</p>
        </motion.div>
      </div>
    </section>
  );
};

export default LegalHero;
