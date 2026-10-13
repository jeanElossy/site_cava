import { Link } from "react-router-dom";

import { motion } from "framer-motion";

import { ArrowUpRight } from "lucide-react";

import { PILLARS, pillarPath } from "../../content/pillars";

import "./AboutPillars.scss";

// Les quatre piliers, lus dans `content/pillars.js` (source unique,
// partagée avec la page de détail `/piliers/:slug`). Chaque carte est un
// lien vers la page de son pilier.
const AboutPillars = () => {
  return (
    <section
      className="about-pillars"
      id="piliers"
      aria-labelledby="about-pillars-title"
    >
      <div className="about-pillars__container">
        <header className="about-pillars__header">
          <div>
            <span className="about-pillars__eyebrow">
              Ce qui soutient la vision de l&apos;Église
            </span>

            <h2 id="about-pillars-title">Nos piliers</h2>
          </div>

          <p>
            Quatre dimensions d&apos;une même Église, pour faire grandir
            chacun dans toutes les sphères de sa vie.
          </p>
        </header>

        <ol className="about-pillars__grid">
          {PILLARS.map((pillar, index) => (
            <motion.li
              key={pillar.slug}
              className="about-pillars__card"
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
            >
              <Link
                to={pillarPath(pillar.slug)}
                className="about-pillars__link"
              >
                <img
                  className="about-pillars__image"
                  src={pillar.image}
                  alt={pillar.alt}
                  width="720"
                  height="900"
                  loading="lazy"
                  decoding="async"
                />

                <span
                  className="about-pillars__number"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span
                  className="about-pillars__arrow"
                  aria-hidden="true"
                >
                  <ArrowUpRight size={20} />
                </span>

                <div className="about-pillars__body">
                  <h3>{pillar.title}</h3>

                  <ul className="about-pillars__verbs">
                    {pillar.verbs.map((verb) => (
                      <li key={verb}>{verb}</li>
                    ))}
                  </ul>

                  <span className="about-pillars__more">
                    Découvrir le pilier
                  </span>
                </div>
              </Link>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
};

export default AboutPillars;
