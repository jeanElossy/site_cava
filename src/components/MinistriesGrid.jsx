import { motion } from "framer-motion";

import {
  FaUsers,
  FaHandsHelping,
  FaBookOpen,
  FaHome,
  FaPeopleCarry,
  FaMicrophone,
} from "react-icons/fa";

import { HiArrowRight } from "react-icons/hi";

import { Link } from "react-router-dom";

import allMinistries from "./MinistryDetails/data/ministries";

import "./MinistriesGrid.scss";

// Icônes par position, dans l'ordre d'affichage. Le modèle ne stocke
// pas d'icône : c'est une décision d'habillage, pas une donnée.
const ICONS = [
  FaUsers,
  FaHandsHelping,
  FaBookOpen,
  FaHome,
  FaPeopleCarry,
  FaMicrophone,
];

// Même source que la page de détail : ne jamais recopier ici titres ou
// slugs (voir CLAUDE.md).
const ministries = Object.values(allMinistries);

// Les cartes s'appellent `.ministries-grid__card` : le nom générique
// `.ministry-card`, déclaré à la racine, s'appliquait aussi aux cartes de
// la page Contact (`MinistryContacts`).
const MinistriesGrid = () => {
  return (
    <section
      className="ministries-grid"
      id="liste-ministeres"
      aria-labelledby="ministries-grid-title"
    >
      <div className="ministries-grid__container">
        <header className="ministries-grid__header">
          <span className="ministries-grid__eyebrow">
            {ministries.length} ministères
          </span>

          <h2 id="ministries-grid-title">Trouvez votre place</h2>

          <p>
            Chaque ministère est une famille au service de l&apos;église et
            de la ville. Découvrez leur mission, leurs responsables et
            comment les rejoindre.
          </p>
        </header>

        <ul className="ministries-grid__list">
          {ministries.map((ministry, index) => {
            const Icon = ICONS[index % ICONS.length];

            return (
              <motion.li
                key={ministry.slug}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.45, delay: (index % 3) * 0.08 }}
              >
                <Link
                  to={`/ministries/${ministry.slug}`}
                  className="ministries-grid__card"
                >
                  <div className="ministries-grid__media">
                    {ministry.image && (
                      <img
                        src={ministry.image}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                  </div>

                  <div className="ministries-grid__body">
                    <span
                      className="ministries-grid__icon"
                      aria-hidden="true"
                    >
                      <Icon />
                    </span>

                    <h3>{ministry.title}</h3>

                    {ministry.description && <p>{ministry.description}</p>}

                    <span className="ministries-grid__more">
                      Découvrir le ministère
                      <HiArrowRight aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};

export default MinistriesGrid;
