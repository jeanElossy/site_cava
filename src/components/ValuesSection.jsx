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
    title: "L’amour",
    text: "L'amour est le fondement de la vie chrétienne et la première marque distinctive du disciple de Jésus-Christ.",
    color: "green",
  },
  {
    icon: <FaUsers />,
    title: "La sainteté et l’intégrité",
    text: "",
    color: "gold",
  },
  {
    icon: <FaAward />,
    title: "L’esprit de service",
    text: "",
    color: "green",
  },
  {
    icon: <FaHandsHelping />,
    title: "La culture de l’honneur",
    text: "",
    color: "gold",
  },
  {
    icon: <FaHandsHelping />,
    title: "La redevabilité",
    text: "",
    color: "gold",
  },
  {
    icon: <FaHandsHelping />,
    title: "L’engagement missionnaire",
    text: "",
    color: "gold",
  },
  {
    icon: <FaShieldAlt />,
    title: "L’excellence",
    text: "",
    color: "green",
  },
  {
    icon: <FaShieldAlt />,
    title: "La discipline et la croissance",
    text: "",
    color: "green",
  },
  {
    icon: <FaShieldAlt />,
    title: "L’unité",
    text: "",
    color: "green",
  },
  {
    icon: <FaShieldAlt />,
    title: "La compassion",
    text: "",
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