import { Link } from "react-router-dom";

import { motion } from "framer-motion";

import { FaArrowRight, FaQuoteLeft } from "react-icons/fa";

import "./CommunityHero.scss";

import heroImage from "../../../assets/images/homegroup.jpg";

const CommunityHero = () => {
  return (
    <section
      className="community-hero"
      style={{
        backgroundImage: `url(${heroImage})`,
      }}
    >
      <div
        className="community-hero__overlay"
        aria-hidden="true"
      ></div>

      <div className="community-hero__container">
        <motion.div
          className="community-hero__content"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <nav
            className="community-hero__breadcrumb"
            aria-label="Fil d'Ariane"
          >
            <Link to="/">Accueil</Link>

            <span aria-hidden="true">/</span>

            <span aria-current="page">Communauté</span>
          </nav>

          <p className="community-hero__eyebrow">Notre communauté</p>

          <h1>
            Une famille où l&apos;on grandit{" "}
            <span className="community-hero__highlight">ensemble</span>,
            jamais seul.
          </h1>

          <p className="community-hero__lead">
            Groupes de maison, prière partagée, entraide : au Centre
            Apostolique Vie et Abondance, la foi se vit aussi en semaine,
            au plus près de chez vous.
          </p>

          <div className="community-hero__actions">
            <Link
              to="/inscription"
              className="community-hero__cta"
            >
              Devenir membre
              <FaArrowRight aria-hidden="true" />
            </Link>

            {/* Ancre interne : un simple lien suffit, le défilement doux
                est déjà global (`_reset.scss`). */}
            <a
              href="#groupes"
              className="community-hero__cta community-hero__cta--ghost"
            >
              Trouver un groupe de maison
            </a>
          </div>
        </motion.div>

        <motion.figure
          className="community-hero__verse"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
        >
          <FaQuoteLeft
            className="community-hero__verse-icon"
            aria-hidden="true"
          />

          <blockquote>
            Ils persévéraient dans l&apos;enseignement des apôtres, dans la
            communion fraternelle, dans la fraction du pain et dans les
            prières.
          </blockquote>

          <figcaption>Actes 2:42</figcaption>
        </motion.figure>
      </div>
    </section>
  );
};

export default CommunityHero;
