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
    text: "Nous choisissons d’aimer Dieu de tout notre cœur et d’aimer notre prochain avec sincérité, respect et bienveillance.",
    color: "green",
  },
  {
    icon: <FaUsers />,
    title: "La sainteté et l’intégrité",
    text: "Nous poursuivons une vie de sainteté dans tous les domaines de notre existence.",
    color: "gold",
  },
  {
    icon: <FaAward />,
    title: "L’esprit de service",
    text: "Nous croyons que l'autorité spirituelle s'exprime d'abord par une vie de service.",
    color: "green",
  },
  {
    icon: <FaHandsHelping />,
    title: "La culture de l’honneur",
    text: "Nous nous engageons à développer une véritable culture de l'honneur.",
    color: "gold",
  },
  {
    icon: <FaHandsHelping />,
    title: "La redevabilité",
    text: "Nous nous engageons à développer une culture de redevabilité à tous les niveaux de son organisation.",
    color: "gold",
  },
  {
    icon: <FaHandsHelping />,
    title: "L’engagement missionnaire",
    text: "Nous croyons que la mission est le privilège et la responsabilité de toute l'Église.",
    color: "gold",
  },
  {
    icon: <FaShieldAlt />,
    title: "L’excellence",
    text: "Nous nous engageons à développer une culture d'excellence dans tous les domaines de son ministère.",
    color: "green",
  },
  {
    icon: <FaShieldAlt />,
    title: "La discipline et la croissance",
    text: "Nous nous engageons à promouvoir une culture de discipline spirituelle et de croissance permanente.",
    color: "green",
  },
  {
    icon: <FaShieldAlt />,
    title: "L’unité",
    text: "Nous nous s’engage à préserver l’unité de l’Église en: Cultivant l’amour fraternel et le respect mutuel.",
    color: "green",
  },
  {
    icon: <FaShieldAlt />,
    title: "La compassion",
    text: "Nous nous engageons à faire de la compassion une expression visible de son témoignage.",
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