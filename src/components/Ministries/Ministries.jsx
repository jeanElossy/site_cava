import {
  Users,
  Heart,
  BookOpen,
  Globe,
  ArrowRight
} from "lucide-react";

import "./Ministries.scss";

const ministries = [
  {
    icon: <Users />,
    title: "Enfance & Jeunesse",
    description:
      "Accompagner les enfants et les jeunes dans leur marche avec Christ.",
    color: "green"
  },
  {
    icon: <Heart />,
    title: "Louange & Adoration",
    description:
      "Élever un son qui transforme les cœurs et attire la présence de Dieu.",
    color: "yellow"
  },
  {
    icon: <BookOpen />,
    title: "Enseignement",
    description:
      "La parole de Dieu enseignée avec clarté pour une vie transformée.",
    color: "green"
  },
  {
    icon: <Globe />,
    title: "Action Sociale",
    description:
      "Manifester l'amour de Christ par des actions concrètes.",
    color: "yellow"
  }
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

        <button className="ministries-btn">
          Découvrir tous les ministères
          <ArrowRight size={18} />
        </button>

      </div>

      <div className="ministries__grid">
        {ministries.map((item, index) => (
          <div className="card" key={index}>

            <div className={`icon ${item.color}`}>
              {item.icon}
            </div>

            <h3>{item.title}</h3>

            <p>{item.description}</p>

            <a href="/">
              En savoir plus
              <ArrowRight size={16} />
            </a>

          </div>
        ))}
      </div>
    </section>
  );
};

export default Ministries;