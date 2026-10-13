import { Link } from "react-router-dom";

import { motion } from "framer-motion";

import { FaQuoteLeft } from "react-icons/fa";
import { HiArrowRight } from "react-icons/hi";

import "./MinistriesHero.scss";

import heroImage from "../assets/images/ministries-hero.jpg";

const MinistriesHero = () => {
  return (
    <section
      className="ministries-hero"
      style={{
        backgroundImage: `url(${heroImage})`,
      }}
    >
      <div
        className="ministries-hero__overlay"
        aria-hidden="true"
      ></div>

      <div className="ministries-hero__container">
        <motion.div
          className="ministries-hero__content"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <nav
            className="ministries-hero__breadcrumb"
            aria-label="Fil d'Ariane"
          >
            <Link to="/">Accueil</Link>

            <span aria-hidden="true">/</span>

            <span aria-current="page">Ministères</span>
          </nav>

          <p className="ministries-hero__eyebrow">Nos ministères</p>

          <h1>
            Des ministères pour{" "}
            <span className="ministries-hero__highlight">bâtir des vies</span>{" "}
            et accomplir la mission de Dieu.
          </h1>

          <p className="ministries-hero__lead">
            Enfance, louange, enseignement, entraide, évangélisation : chacun
            peut trouver sa place pour servir et grandir.
          </p>

          <div className="ministries-hero__actions">
            <a
              href="#liste-ministeres"
              className="ministries-hero__cta"
            >
              Découvrir les ministères
              <HiArrowRight aria-hidden="true" />
            </a>
          </div>
        </motion.div>

        <motion.figure
          className="ministries-hero__verse"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
        >
          <FaQuoteLeft
            className="ministries-hero__verse-icon"
            aria-hidden="true"
          />

          <blockquote>
            Que chacun mette au service des autres le don qu&apos;il a reçu,
            comme de bons gestionnaires de la grâce de Dieu.
          </blockquote>

          <figcaption>1 Pierre 4:10</figcaption>
        </motion.figure>
      </div>
    </section>
  );
};

export default MinistriesHero;
