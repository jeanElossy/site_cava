import { motion } from "framer-motion";

import {
  FaUsers,
  FaHandsHelping,
  FaHeart,
  FaGlobe,
} from "react-icons/fa";

import allMinistries from "./MinistryDetails/data/ministries";

import "./MinistriesStats.scss";

const ministries = Object.values(allMinistries);

// Nombre de responsables réellement enregistrés, tous ministères
// confondus. Sans aucun responsable saisi, on n'affiche pas « 0 » :
// mieux vaut une formule honnête qu'un chiffre décourageant.
const leaderCount = ministries.reduce(
  (total, item) => total + (item.leaders?.length ?? 0),
  0
);

// Les deux premiers chiffres sont comptés dans les données (ils étaient
// auparavant écrits en dur, et faux) ; les deux derniers sont des
// formules, pas des mesures.
const stats = [
  {
    id: "ministeres",
    icon: FaUsers,
    value: String(ministries.length),
    label:
      ministries.length > 1 ? "Ministères actifs" : "Ministère actif",
  },
  {
    id: "responsables",
    icon: FaHandsHelping,
    value: leaderCount > 0 ? String(leaderCount) : "Nombreux",
    label: "Responsables engagés",
  },
  {
    id: "vies",
    icon: FaHeart,
    value: "Des milliers",
    label: "de vies impactées",
  },
  {
    id: "but",
    icon: FaGlobe,
    value: "Un seul but",
    label: "La gloire de Dieu",
  },
];

const MinistriesStats = () => {
  return (
    <section
      className="ministries-stats"
      aria-label="Les ministères en chiffres"
    >
      <div className="ministries-stats__container">
        <ul className="ministries-stats__panel">
          {stats.map((stat, index) => {
            const Icon = stat.icon;

            return (
              <motion.li
                key={stat.id}
                className="ministries-stats__item"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
              >
                <span
                  className="ministries-stats__icon"
                  aria-hidden="true"
                >
                  <Icon />
                </span>

                <span className="ministries-stats__figures">
                  <span className="ministries-stats__value">
                    {stat.value}
                  </span>
                  <span className="ministries-stats__label">
                    {stat.label}
                  </span>
                </span>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};

export default MinistriesStats;
