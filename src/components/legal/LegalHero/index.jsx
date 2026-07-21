import { motion } from "framer-motion";

import { Link } from "react-router-dom";

import "./LegalHero.scss";

import defaultImage from "../../../assets/images/bible.jpg";

// Héros des pages légales.
//
// Il reprend la structure des autres héros du site (image de fond,
// dégradé de lisibilité, fil d'Ariane, titre, filet doré) : jusqu'ici
// ces deux pages s'ouvraient sur un simple aplat vert, nettement plus
// bas et sans image, ce qui les faisait ressembler à une annexe plutôt
// qu'à une page du site.
const LegalHero = ({ title, intro, image = defaultImage }) => {
  return (
    <section
      className="legal-hero"
      style={{ backgroundImage: `url(${image})` }}
    >
      <div className="legal-hero__overlay" aria-hidden="true"></div>

      <div className="legal-hero__container">
        <motion.div
          className="legal-hero__content"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <nav
            className="legal-hero__breadcrumb"
            aria-label="Fil d'Ariane"
          >
            <Link to="/">Accueil</Link>

            <span aria-hidden="true">/</span>

            <span aria-current="page">{title}</span>
          </nav>

          <h1 className="legal-hero__title">{title}</h1>

          <div className="legal-hero__line" aria-hidden="true"></div>

          <p className="legal-hero__intro">{intro}</p>
        </motion.div>
      </div>
    </section>
  );
};

export default LegalHero;
