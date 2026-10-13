import { motion } from "framer-motion";

import { ArrowRight, ArrowUpRight } from "lucide-react";

import { Link } from "react-router-dom";

import allMinistries from "../MinistryDetails/data/ministries";

import "./Ministries.scss";

// Les ministères de l'accueil, lus depuis la source unique
// (`MinistryDetails/data/ministries.js`, déjà triée par `order`) : ne
// jamais recopier ici titres ou liens, voir CLAUDE.md.
const featured = Object.values(allMinistries).slice(0, 6);

const Ministries = () => {
  return (
    <section
      className="home-ministries"
      aria-labelledby="home-ministries-title"
    >
      <div className="home-ministries__container">
        <header className="home-ministries__header">
          <div>
            <span className="home-ministries__eyebrow">
              Nos ministères
            </span>

            <h2 id="home-ministries-title">
              Des ministères pour bâtir des vies
            </h2>
          </div>

          <div className="home-ministries__intro">
            <p>
              Chacun peut trouver sa place pour servir, grandir et impacter
              pour le Royaume.
            </p>

            <Link
              to="/ministries"
              className="home-ministries__all"
            >
              Tous les ministères
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </header>

        <ul className="home-ministries__grid">
          {featured.map((item, index) => (
            <motion.li
              key={item.slug}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.45, delay: (index % 3) * 0.08 }}
            >
              <Link
                to={`/ministries/${item.slug}`}
                className="home-ministries__card"
              >
                {item.image && (
                  <img
                    src={item.image}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                )}

                <span
                  className="home-ministries__shade"
                  aria-hidden="true"
                ></span>

                <div className="home-ministries__content">
                  <h3>{item.title}</h3>

                  {item.description && <p>{item.description}</p>}
                </div>

                <span
                  className="home-ministries__arrow"
                  aria-hidden="true"
                >
                  <ArrowUpRight size={20} />
                </span>
              </Link>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default Ministries;
