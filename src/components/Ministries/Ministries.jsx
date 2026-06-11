import {
  Users,
  Heart,
  BookOpen,
  Globe,
  ArrowRight,
} from "lucide-react";

import { Link } from "react-router-dom";

import "./Ministries.scss";

const ministries = [
  {
    icon: <Users />,
    title: "Enfance & Jeunesse",
    description:
      "Accompagner les enfants et les jeunes dans leur marche avec Christ.",
    color: "green",
    link: "/ministries/enfance-jeunesse",
  },
  {
    icon: <Heart />,
    title: "Louange & Adoration",
    description:
      "Élever un son qui transforme les cœurs et attire la présence de Dieu.",
    color: "yellow",
    link: "/ministries/louange-adoration",
  },
  {
    icon: <BookOpen />,
    title: "Enseignement",
    description:
      "La parole de Dieu enseignée avec clarté pour une vie transformée.",
    color: "green",
    link: "/ministries/enseignement",
  },
  {
    icon: <Globe />,
    title: "Action Sociale",
    description:
      "Manifester l'amour de Christ par des actions concrètes.",
    color: "yellow",
    link: "/ministries/action-sociale",
  },
];

const Ministries = () => {
  return (
    <section className="ministries">

      <div className="ministries__left">

        <span className="section-tag">
          NOS MINISTÈRES
        </span>

        <h2>
          Des ministères pour
          bâtir des vies
        </h2>

        <div className="line"></div>

        <p>
          Découvrez les différents ministères où chacun
          peut servir, grandir et impacter pour le Royaume.
        </p>

        <Link
          to="/ministries"
          className="ministries-btn"
        >
          Découvrir tous les ministères
          <ArrowRight size={18} />
        </Link>

      </div>

      <div className="ministries__grid">

        {ministries.map((item, index) => (
          <div
            className="card"
            key={index}
          >

            <div className={`icon ${item.color}`}>
              {item.icon}
            </div>

            <h3>{item.title}</h3>

            <p>{item.description}</p>

            <Link
              to={item.link}
              className="card-link"
            >
              En savoir plus
              <ArrowRight size={16} />
            </Link>

          </div>
        ))}

      </div>

    </section>
  );
};

export default Ministries;