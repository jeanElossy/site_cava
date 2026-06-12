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

import childrenImg from "../assets/images/children.jpg";
import worshipImg from "../assets/images/worship.jpg";
import teachingImg from "../assets/images/teaching.jpg";
import homegroupImg from "../assets/images/homegroup.jpg";
import socialImg from "../assets/images/social.jpg";
import evangelismImg from "../assets/images/evangelism.jpg";


import { Link } from "react-router-dom";



const ministries = [
  {
    slug: "enfance-jeunesse",
    title: "Enfance & Jeunesse",
    description:
      "Accompagner les enfants et les jeunes dans leur marche avec Christ.",
    image: childrenImg,
    icon: <FaUsers />,
    color: "green",
  },

  {
    slug: "louange-adoration",
    title: "Louange & Adoration",
    description:
      "Élever un son qui transforme les cœurs et attire la présence de Dieu.",
    image: worshipImg,
    icon: <FaHandsHelping />,
    color: "gold",
  },

  {
    slug: "enseignement",
    title: "Enseignement",
    description:
      "La parole de Dieu enseignée avec clarté pour une vie transformée.",
    image: teachingImg,
    icon: <FaBookOpen />,
    color: "green",
  },

  {
    slug: "groupes-de-maison",
    title: "Groupes de maison",
    description:
      "Vivre la foi en petits groupes, partager et s'encourager mutuellement.",
    image: homegroupImg,
    icon: <FaHome />,
    color: "gold",
  },

  {
    slug: "action-sociale",
    title: "Action Sociale",
    description:
      "Manifester l'amour de Christ par des actions concrètes envers notre prochain.",
    image: socialImg,
    icon: <FaPeopleCarry />,
    color: "green",
  },

  {
    slug: "evangelisation",
    title: "Évangélisation",
    description:
      "Annoncer l'Évangile et gagner des âmes pour le Royaume de Dieu.",
    image: evangelismImg,
    icon: <FaMicrophone />,
    color: "gold",
  },
];


const MinistriesGrid = () => {
  return (
    <section className="ministries-grid">
      <div className="ministries-grid__container">

        {ministries.map((ministry, index) => (
          <article
            key={index}
            className="ministry-card"
          >
            <div className="ministry-card__top">

              <div
                className={`ministry-card__badge ministry-card__badge--${ministry.color}`}
              >
                <div className="ministry-card__icon">
                  {ministry.icon}
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