import { motion } from "framer-motion";

import {
  HiUsers,
  HiHome,
  HiShieldCheck,
  HiHeart,
} from "react-icons/hi";

import "./StatsSection.scss";

// Chiffres éditoriaux de la page À propos, écrits en dur. Ils ne viennent
// pas du registre (voir `content/community.js` pour les chiffres
// comptés) : à faire confirmer par l'église — voir
// docs/SUIVI-REFONTE-SITE.md.
const stats = [
  {
    id: "vies",
    icon: HiUsers,
    value: "+ 1500",
    label: "Vies impactées",
  },
  {
    id: "groupes",
    icon: HiHome,
    value: "+ 25",
    label: "Groupes de maison",
  },
  {
    id: "benevoles",
    icon: HiShieldCheck,
    value: "+ 30",
    label: "Bénévoles engagés",
  },
  {
    id: "annees",
    icon: HiHeart,
    value: "+ 10",
    label: "Années de ministère",
  },
];

const StatsSection = () => {
  return (
    <section
      className="stats-section"
      aria-label="L'église en chiffres"
    >
      <div className="stats-section__container">
        <ul className="stats-section__panel">
          {stats.map((stat, index) => {
            const Icon = stat.icon;

            return (
              <motion.li
                key={stat.id}
                className="stats-section__item"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
              >
                <span
                  className="stats-section__icon"
                  aria-hidden="true"
                >
                  <Icon />
                </span>

                <span className="stats-section__figures">
                  <span className="stats-section__value">{stat.value}</span>
                  <span className="stats-section__label">{stat.label}</span>
                </span>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};

export default StatsSection;
