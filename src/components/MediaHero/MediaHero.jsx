import { Link } from "react-router-dom";

import { motion } from "framer-motion";

import { ArrowRight } from "lucide-react";

import heroImg from "../../assets/images/media-hero.jpg";

import "./MediaHero.scss";

const MediaHero = () => {
  return (
    <section
      className="media-hero"
      style={{
        backgroundImage: `url(${heroImg})`,
      }}
    >
      <div
        className="media-hero__overlay"
        aria-hidden="true"
      />

      <div className="media-hero__container">
        <motion.div
          className="media-hero__content"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <nav
            className="media-hero__breadcrumb"
            aria-label="Fil d'Ariane"
          >
            <Link to="/">Accueil</Link>

            <span aria-hidden="true">/</span>

            <span aria-current="page">Médias</span>
          </nav>

          <p className="media-hero__eyebrow">Enseignements &amp; louange</p>

          <h1>
            Nos <span className="media-hero__highlight">médias</span>
          </h1>

          <p className="media-hero__lead">
            Retrouvez nos messages, louanges et témoignages pour nourrir
            votre foi au quotidien, où que vous soyez.
          </p>

          <div className="media-hero__actions">
            <a
              href="#mediatheque"
              className="media-hero__cta"
            >
              Parcourir la médiathèque
              <ArrowRight size={18} aria-hidden="true" />
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default MediaHero;
