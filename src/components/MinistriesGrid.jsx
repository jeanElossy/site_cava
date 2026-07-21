import "./MinistriesGrid.scss";

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



// Icônes par position, dans l'ordre d'affichage. Le modèle ne stocke
// pas d'icône : c'est une décision d'habillage, pas une donnée.
const ICONS = [
  <FaUsers />,
  <FaHandsHelping />,
  <FaBookOpen />,
  <FaHome />,
  <FaPeopleCarry />,
  <FaMicrophone />,
];

// Alternance verte/dorée, pour conserver le rythme visuel d'origine.
//
// « gold » et non « yellow » : c'est le nom du modificateur défini dans
// MinistriesGrid.scss. Un nom inexistant ne produit aucune erreur — la
// pastille reste simplement sans fond, et son icône blanche devient
// invisible.
const cardColor = (index) => (index % 2 === 0 ? "green" : "gold");

// La liste des ministères était recopiée en dur ici, en double du
// module de données. C'est la duplication que CLAUDE.md signale
// explicitement : les slugs concordaient « aujourd'hui », et toute
// divergence menait une carte vers « Ministère introuvable ».
//
// Elle lit désormais la même source que la page de détail.
const ministries = Object.values(allMinistries);


const MinistriesGrid = () => {
  return (
    <section className="ministries-grid">
      <div className="ministries-grid__container">

        {ministries.map((ministry, index) => (
          <article
            key={ministry.slug}
            className="ministry-card"
          >
            <div className="ministry-card__top">

              <div
                className={`ministry-card__badge ministry-card__badge--${cardColor(index)}`}
              >
                <div className="ministry-card__icon">
                  {ICONS[index % ICONS.length]}
                </div>
              </div>

              <div className="ministry-card__image">
                <img
                  src={ministry.image}
                  alt={ministry.title}
                />
              </div>

            </div>

            <div className="ministry-card__content">

              <h3>{ministry.title}</h3>

              <p>{ministry.description}</p>

              <Link
                to={`/ministries/${ministry.slug}`}
                className="ministry-card__button"
              >
                En savoir plus
                <HiArrowRight />
              </Link>


            </div>
          </article>
        ))}

      </div>
    </section>
  );
};

export default MinistriesGrid;