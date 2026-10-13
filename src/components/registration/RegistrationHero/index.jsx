import { Link } from "react-router-dom";

import { motion } from "framer-motion";

import { HiArrowRight } from "react-icons/hi";

import heroImage from "../../../assets/images/family.jpg";

import "./RegistrationHero.scss";

// Même mécanique que les héros d'intérieur du site (mixin `page-hero`).
// Le seul élément propre à cette page est le badge matricule, qui ancre
// le héros dans le sujet concret (l'identité numérotée de chaque membre)
// plutôt que d'être une bannière interchangeable.
const RegistrationHero = () => {
  return (
    <section
      className="registration-hero"
      style={{
        backgroundImage: `url(${heroImage})`,
      }}
    >
      <div
        className="registration-hero__overlay"
        aria-hidden="true"
      />

      <div className="registration-hero__container">
        <motion.div
          className="registration-hero__content"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <nav
            className="registration-hero__breadcrumb"
            aria-label="Fil d'Ariane"
          >
            <Link to="/">Accueil</Link>

            <span aria-hidden="true">/</span>

            <Link to="/communaute">Communauté</Link>

            <span aria-hidden="true">/</span>

            <span aria-current="page">Devenir membre</span>
          </nav>

          <p className="registration-hero__eyebrow">
            Rejoignez la famille CAVA
          </p>

          <h1>
            Devenir <span className="registration-hero__highlight">membre</span>{" "}
            du Centre Apostolique Vie et Abondance
          </h1>

          <p className="registration-hero__lead">
            Que vous rejoigniez la famille CAVA pour la première fois ou que
            vous possédiez déjà un matricule, cette page vous permet de
            déclarer ou de mettre à jour vos informations. Une équipe
            vérifie chaque demande avant son enregistrement définitif.
          </p>

          <div className="registration-hero__actions">
            <a
              href="#registration-form"
              className="registration-hero__cta"
            >
              Commencer mon inscription
              <HiArrowRight aria-hidden="true" />
            </a>
          </div>

          <div
            className="registration-hero__badge"
            aria-hidden="true"
          >
            <span className="registration-hero__badge-label">
              Votre identité dans l&apos;église
            </span>

            {/* Forme du matricule, pas un exemple réel : un vrai numéro
                pourrait coïncider avec celui d'un membre existant et
                prêter à confusion. */}
            <span className="registration-hero__badge-code">
              XXX XX-XXX X
            </span>

            <span className="registration-hero__badge-caption">
              Un matricule unique, attribué à la validation de votre
              inscription
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default RegistrationHero;
