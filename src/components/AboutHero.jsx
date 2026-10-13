import { Link } from "react-router-dom";

import { motion } from "framer-motion";

import { HiArrowRight } from "react-icons/hi";

import "./AboutHero.scss";

import heroImage from "../assets/images/about-hero.jpg";

const AboutHero = () => {
  return (
    <section
      className="about-hero"
      style={{
        backgroundImage: `url(${heroImage})`,
      }}
    >
      <div
        className="about-hero__overlay"
        aria-hidden="true"
      ></div>

      <div className="about-hero__container">
        <motion.div
          className="about-hero__content"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <nav
            className="about-hero__breadcrumb"
            aria-label="Fil d'Ariane"
          >
            <Link to="/">Accueil</Link>

            <span aria-hidden="true">/</span>

            <span aria-current="page">À propos</span>
          </nav>

          <p className="about-hero__eyebrow">À propos de nous</p>

          <h1>
            Une église centrée sur Christ, pour{" "}
            <span className="about-hero__highlight">transformer des vies</span>{" "}
            et impacter notre génération.
          </h1>

          <p className="about-hero__lead">
            Le Centre Apostolique Vie et Abondance est une église passionnée
            par la présence de Dieu et par l&apos;amour authentique manifesté
            en Jésus-Christ.
          </p>

          <div className="about-hero__actions">
            <a
              href="#vision"
              className="about-hero__cta"
            >
              Notre vision
              <HiArrowRight aria-hidden="true" />
            </a>

            <Link
              to="/ministries"
              className="about-hero__cta about-hero__cta--ghost"
            >
              Nos ministères
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default AboutHero;
