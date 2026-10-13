import { motion } from "framer-motion";

import {
  FaAward,
  FaBalanceScale,
  FaCrown,
  FaDove,
  FaGlobeAfrica,
  FaHandHoldingHeart,
  FaHandsHelping,
  FaHeart,
  FaSeedling,
  FaUsers,
} from "react-icons/fa";

import "./ValuesSection.scss";

// Une icône par valeur. Cinq valeurs partageaient auparavant le même
// bouclier, et « L'amour » était illustré par une croix.
const values = [
  {
    id: "amour",
    icon: FaHeart,
    title: "L’amour",
    text: "Nous choisissons d’aimer Dieu de tout notre cœur et d’aimer notre prochain avec sincérité, respect et bienveillance.",
  },
  {
    id: "saintete",
    icon: FaDove,
    title: "La sainteté et l’intégrité",
    text: "Nous poursuivons une vie de sainteté dans tous les domaines de notre existence.",
  },
  {
    id: "service",
    icon: FaHandsHelping,
    title: "L’esprit de service",
    text: "Nous croyons que l'autorité spirituelle s'exprime d'abord par une vie de service.",
  },
  {
    id: "honneur",
    icon: FaCrown,
    title: "La culture de l’honneur",
    text: "Nous nous engageons à développer une véritable culture de l'honneur.",
  },
  {
    id: "redevabilite",
    icon: FaBalanceScale,
    title: "La redevabilité",
    text: "Nous nous engageons à développer une culture de redevabilité à tous les niveaux de notre organisation.",
  },
  {
    id: "mission",
    icon: FaGlobeAfrica,
    title: "L’engagement missionnaire",
    text: "Nous croyons que la mission est le privilège et la responsabilité de toute l'Église.",
  },
  {
    id: "excellence",
    icon: FaAward,
    title: "L’excellence",
    text: "Nous nous engageons à développer une culture d'excellence dans tous les domaines de notre ministère.",
  },
  {
    id: "discipline",
    icon: FaSeedling,
    title: "La discipline et la croissance",
    text: "Nous nous engageons à promouvoir une culture de discipline spirituelle et de croissance permanente.",
  },
  {
    id: "unite",
    icon: FaUsers,
    title: "L’unité",
    text: "Nous nous engageons à préserver l’unité de l’Église en cultivant l’amour fraternel et le respect mutuel.",
  },
  {
    id: "compassion",
    icon: FaHandHoldingHeart,
    title: "La compassion",
    text: "Nous nous engageons à faire de la compassion une expression visible de notre témoignage.",
  },
];

const ValuesSection = () => {
  return (
    <section
      className="values-section"
      aria-labelledby="values-section-title"
    >
      <div className="values-section__container">
        <header className="values-section__header">
          <span className="values-section__eyebrow">Ce qui nous anime</span>

          <h2 id="values-section-title">Nos valeurs</h2>

          <p>
            Dix convictions qui façonnent notre manière de vivre la foi,
            de servir et de nous aimer les uns les autres.
          </p>
        </header>

        <ol className="values-section__grid">
          {values.map((value, index) => {
            const Icon = value.icon;

            return (
              <motion.li
                key={value.id}
                className="values-section__card"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.4, delay: (index % 5) * 0.06 }}
              >
                <div className="values-section__card-top">
                  <span
                    className="values-section__icon"
                    aria-hidden="true"
                  >
                    <Icon />
                  </span>

                  <span
                    className="values-section__number"
                    aria-hidden="true"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>

                <h3>{value.title}</h3>

                <p>{value.text}</p>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </section>
  );
};

export default ValuesSection;
