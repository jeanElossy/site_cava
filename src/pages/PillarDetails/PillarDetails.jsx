import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";

import { motion } from "framer-motion";

import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Eye,
  Landmark,
  Target,
} from "lucide-react";

import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";

import { PILLARS, findPillar, pillarPath } from "../../content/pillars";

import usePageMeta from "../../hooks/usePageMeta";

import "./PillarDetails.scss";

const pad = (value) => String(value).padStart(2, "0");

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.5, ease: "easeOut" },
};

// Page d'un pilier (`/piliers/:slug`). Contenu lu dans
// `content/pillars.js`, partagé avec la section « Nos piliers » de la
// page À propos. Montée avec `key={slug}` (voir AppRoutes.jsx).
const PillarDetails = () => {
  const { slug } = useParams();

  const pillar = findPillar(slug);
  const index = pillar ? PILLARS.indexOf(pillar) : -1;
  const others = PILLARS.filter((item) => item !== pillar);

  usePageMeta({
    title: pillar ? `Le pilier ${pillar.name}` : "Pilier introuvable",
    description: pillar
      ? `${pillar.verbs.join(", ")} — ${pillar.summary}`
      : "Ce pilier n'existe pas.",
  });

  // On arrive depuis le bas de la page À propos : sans cela, la page
  // s'ouvrirait au milieu du défilement précédent.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (!pillar) {
    return (
      <>
        <Navbar />

        <main className="pillar-page pillar-page--missing">
          <h1>Pilier introuvable</h1>

          <p>Ce pilier n&apos;existe pas ou n&apos;est plus disponible.</p>

          <Link
            to="/about#piliers"
            className="pillar-page__missing-back"
          >
            Voir nos piliers
          </Link>
        </main>

        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />

      <main className="pillar-page">
        {/* HERO — texte à gauche, photo encadrée à droite */}
        <section className="pillar-page__hero">
          <div
            className="pillar-page__hero-glow"
            aria-hidden="true"
          />

          <div className="pillar-page__hero-inner">
            <motion.div
              className="pillar-page__hero-content"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <nav
                className="pillar-page__breadcrumb"
                aria-label="Fil d'Ariane"
              >
                <Link to="/">Accueil</Link>

                <span aria-hidden="true">/</span>

                <Link to="/about#piliers">Nos piliers</Link>

                <span aria-hidden="true">/</span>

                <span aria-current="page">{pillar.name}</span>
              </nav>

              <p className="pillar-page__eyebrow">
                Pilier {pad(index + 1)} sur {pad(PILLARS.length)}
              </p>

              <h1>
                Le pilier{" "}
                <span className="pillar-page__highlight">{pillar.name}</span>
              </h1>

              <ul
                className="pillar-page__verbs"
                aria-label="Les trois verbes du pilier"
              >
                {pillar.verbs.map((verb) => (
                  <li key={verb}>{verb}</li>
                ))}
              </ul>

              <p className="pillar-page__lead">{pillar.statement}</p>

              <div className="pillar-page__actions">
                <a
                  href="#objectifs"
                  className="pillar-page__cta"
                >
                  Voir les objectifs
                  <ArrowRight size={18} aria-hidden="true" />
                </a>

                <Link
                  to="/about#piliers"
                  className="pillar-page__cta pillar-page__cta--ghost"
                >
                  <ArrowLeft size={18} aria-hidden="true" />
                  Tous les piliers
                </Link>
              </div>
            </motion.div>

            <motion.figure
              className="pillar-page__figure"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
            >
              <img
                src={pillar.image}
                alt={pillar.alt}
                width="720"
                height="900"
                decoding="async"
                fetchPriority="high"
              />

              <figcaption className="pillar-page__figure-caption">
                <span>Pilier {pad(index + 1)}</span>
                {pillar.title}
              </figcaption>
            </motion.figure>
          </div>
        </section>

        {/* DÉFINITION + VISION */}
        <section
          className="pillar-page__intro"
          aria-labelledby="pillar-definition-title"
        >
          <div className="pillar-page__intro-inner">
            <motion.div
              className="pillar-page__definition"
              {...reveal}
            >
              <p className="pillar-page__section-eyebrow">Définition</p>

              <h2 id="pillar-definition-title">
                Ce que représente le pilier {pillar.name}
              </h2>

              {pillar.definition.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </motion.div>

            <motion.aside
              className="pillar-page__vision"
              aria-labelledby="pillar-vision-title"
              {...reveal}
              transition={{ ...reveal.transition, delay: 0.1 }}
            >
              <span
                className="pillar-page__vision-icon"
                aria-hidden="true"
              >
                <Eye size={24} />
              </span>

              <h2 id="pillar-vision-title">
                Vision du pilier {pillar.name}
              </h2>

              <p>{pillar.vision}</p>
            </motion.aside>
          </div>
        </section>

        {/* OBJECTIFS */}
        <section
          className="pillar-page__objectives"
          id="objectifs"
          aria-labelledby="pillar-objectives-title"
        >
          <div className="pillar-page__container">
            <header className="pillar-page__section-head">
              <p className="pillar-page__section-eyebrow">Objectifs</p>

              <h2 id="pillar-objectives-title">
                Objectifs du pilier {pillar.name}
              </h2>

              <p>Le pilier {pillar.name} vise à :</p>
            </header>

            <ol className="pillar-page__objective-list">
              {pillar.objectives.map((objective, position) => (
                <motion.li
                  key={objective}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.4, delay: position * 0.05 }}
                >
                  <span
                    className="pillar-page__objective-number"
                    aria-hidden="true"
                  >
                    {pad(position + 1)}
                  </span>

                  <p>{objective}</p>
                </motion.li>
              ))}
            </ol>
          </div>
        </section>

        {/* STRUCTURES CONCERNÉES */}
        <section
          className="pillar-page__structures"
          aria-labelledby="pillar-structures-title"
        >
          <div className="pillar-page__structures-inner">
            <header className="pillar-page__structures-head">
              <span
                className="pillar-page__structures-icon"
                aria-hidden="true"
              >
                <Landmark size={26} />
              </span>

              <p className="pillar-page__section-eyebrow">
                Structures concernées
              </p>

              <h2 id="pillar-structures-title">
                Ce qui porte ce pilier au quotidien
              </h2>

              <p>Ce pilier comprend notamment :</p>
            </header>

            <ul className="pillar-page__structure-list">
              {pillar.structures.map((structure) => (
                <li key={structure}>
                  <CheckCircle2
                    size={20}
                    aria-hidden="true"
                  />

                  <span>{structure}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* APPLICATION À ÇA.VA. */}
        <section
          className="pillar-page__application"
          aria-labelledby="pillar-application-title"
        >
          <motion.div
            className="pillar-page__application-inner"
            {...reveal}
          >
            <p
              className="pillar-page__section-eyebrow pillar-page__section-eyebrow--on-dark"
              id="pillar-application-title"
            >
              Application à ÇA.VA.
            </p>

            <blockquote className="pillar-page__application-lead">
              {pillar.application.lead}
            </blockquote>

            <div className="pillar-page__application-body">
              {pillar.application.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>

            <p className="pillar-page__priority">
              <Target
                size={22}
                aria-hidden="true"
              />

              <span>{pillar.application.priority}</span>
            </p>
          </motion.div>
        </section>

        {/* LES AUTRES PILIERS */}
        <section
          className="pillar-page__others"
          aria-labelledby="pillar-others-title"
        >
          <div className="pillar-page__container">
            <header className="pillar-page__others-head">
              <div>
                <p className="pillar-page__section-eyebrow">
                  Nos piliers
                </p>

                <h2 id="pillar-others-title">
                  Découvrir les autres piliers
                </h2>
              </div>

              <Link
                to="/about#piliers"
                className="pillar-page__others-all"
              >
                Voir les quatre piliers
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </header>

            <ul className="pillar-page__others-list">
              {others.map((item) => (
                <li key={item.slug}>
                  <Link
                    to={pillarPath(item.slug)}
                    className="pillar-page__other"
                  >
                    <img
                      src={item.image}
                      alt=""
                      width="720"
                      height="900"
                      loading="lazy"
                      decoding="async"
                    />

                    <span
                      className="pillar-page__other-arrow"
                      aria-hidden="true"
                    >
                      <ArrowUpRight size={18} />
                    </span>

                    <span className="pillar-page__other-body">
                      <span className="pillar-page__other-number">
                        Pilier {pad(PILLARS.indexOf(item) + 1)}
                      </span>

                      <span className="pillar-page__other-title">
                        {item.title}
                      </span>

                      <span className="pillar-page__other-verbs">
                        {item.verbs.join(" · ")}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
};

export default PillarDetails;
