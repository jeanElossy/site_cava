import { Link } from "react-router-dom";

import { motion } from "framer-motion";

import { FaHeart } from "react-icons/fa";

import "./ContributionHero.scss";

import donateImg from "../../../assets/images/donation-hero.jpg";

const ContributionHero = () => {
  return (
    <section
      className="contribution-hero"
      style={{ backgroundImage: `url(${donateImg})` }}
    >
      <div
        className="contribution-hero__overlay"
        aria-hidden="true"
      />

      <div className="contribution-hero__container">
        <motion.div
          className="contribution-hero__content"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <nav
            className="contribution-hero__breadcrumb"
            aria-label="Fil d'Ariane"
          >
            <Link to="/">Accueil</Link>

            <span aria-hidden="true">/</span>

            <span aria-current="page">Faire un don</span>
          </nav>

          <p className="contribution-hero__eyebrow">
            Dîmes · Offrandes · Contributions
          </p>

          <h1>
            Contribuez à l&apos;œuvre{" "}
            <span className="contribution-hero__highlight">de Dieu</span>
          </h1>

          <p className="contribution-hero__lead">
            Vos dîmes, offrandes et contributions soutiennent
            l&apos;évangélisation, l&apos;action sociale, la formation
            biblique et le développement des projets de l&apos;église.
          </p>

          {/* Le formulaire de contribution est plus bas sur la même page :
              les boutons y renvoient par ancre. */}
          <div className="contribution-hero__actions">
            <a
              href="#contribution-form"
              className="contribution-hero__cta"
            >
              <FaHeart aria-hidden="true" />
              Contribuer maintenant
            </a>

            <a
              href="#types"
              className="contribution-hero__cta contribution-hero__cta--ghost"
            >
              Choisir un type de don
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default ContributionHero;
