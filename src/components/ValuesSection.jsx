import "./ValuesSection.scss";

import {
  FaCross,
  FaUsers,
  FaAward,
  FaHandsHelping,
  FaShieldAlt,
} from "react-icons/fa";

const values = [
  {
    icon: <FaCross />,
    title: "Jésus-Christ au centre",
    text: "Tout ce que nous faisons repose sur l'Évangile.",
    color: "green",
  },
  {
    icon: <FaUsers />,
    title: "La famille avant tout",
    text: "Nous vivons l'amour et l'unité.",
    color: "gold",
  },
  {
    icon: <FaAward />,
    title: "L'excellence dans tout",
    text: "Nous élevons le meilleur pour la gloire de Dieu.",
    color: "green",
  },
  {
    icon: <FaHandsHelping />,
    title: "L'impact qui dure",
    text: "Nous semons auprès de tous et partout.",
    color: "gold",
  },
  {
    icon: <FaShieldAlt />,
    title: "L'amour en action",
    text: "Nous servons avec compassion et générosité.",
    color: "green",
  },
];

const ValuesSection = () => {
  return (
    <section className="values-section">
      <div className="values-section__container">

        <div className="values-section__header">
          <h2>NOS VALEURS</h2>

          <div className="values-section__line"></div>
        </div>

        <div className="values-section__grid">
          {values.map((value, index) => (
            <div
              key={index}
              className="value-card"
            >
              <div
                className={`value-card__icon value-card__icon--${value.color}`}
              >
                {value.icon}
              </div>

              <h3>{value.title}</h3>

              <p>{value.text}</p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default ValuesSection;