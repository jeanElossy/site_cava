import { Link } from "react-router-dom";

import { motion } from "framer-motion";

import { HiArrowRight } from "react-icons/hi";

import heroImage from "../../../assets/images/candidature-hero.webp";

import "./CandidatureHero.scss";

// Hero commun du site (mixin `page-hero`), avec les deux signatures de
// l'affiche de la campagne : la pastille inclinée et les quatre mots
// d'ambiance.
//
// Le hero s'anime À L'ARRIVÉE (`animate`), pas au défilement : il est
// déjà à l'écran au chargement.
const CandidatureHero = () => {
  return (
    <section
      className="candidature-hero"
      style={{ backgroundImage: `url(${heroImage})` }}
    >
      <div
        className="candidature-hero__overlay"
        aria-hidden="true"
      />

      <div className="candidature-hero__container">
        <motion.div
          className="candidature-hero__content"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <nav
            className="candidature-hero__breadcrumb"
            aria-label="Fil d'Ariane"
          >
            <Link to="/">Accueil</Link>

            <span aria-hidden="true">/</span>

            <Link to="/communaute">Communauté</Link>

            <span aria-hidden="true">/</span>

            <span aria-current="page">Appel à candidatures</span>
          </nav>

          <p className="candidature-hero__eyebrow">Appel à candidatures</p>

          <h1>
            ÇA.VA. se structure. Et si vous preniez votre place pour{" "}
            <span className="candidature-hero__highlight">servir ?</span>
          </h1>

          <p className="candidature-hero__lead">
            Dans le cadre de la constitution et du renforcement de ses
            structures, ÇA.VA. recherche des hommes et des femmes disposés à
            mettre leurs dons, leurs compétences et leur disponibilité au
            service de la vision.
          </p>

          <div className="candidature-hero__actions">
            <a
              href="#postes"
              className="candidature-hero__cta"
            >
              Voir les postes ouverts
              <HiArrowRight aria-hidden="true" />
            </a>

            <a
              href="#candidature-formulaire"
              className="candidature-hero__cta candidature-hero__cta--ghost"
            >
              Faire acte de candidature
            </a>
          </div>
        </motion.div>

        <motion.div
          className="candidature-hero__aside"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25, ease: "easeOut" }}
        >
          <p className="candidature-hero__badge">
            Des serviteurs pour une Église qui impacte !
          </p>

          {/* Décoratif : le sens est déjà porté par le texte. */}
          <ul
            className="candidature-hero__keywords"
            aria-hidden="true"
          >
            {["Vision", "Service", "Unité", "Impact"].map((word) => (
              <li key={word}>{word}</li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  );
};

export default CandidatureHero;
