import "./MinistriesStats.scss";

import {
  FaUsers,
  FaHandsHelping,
  FaHeart,
  FaGlobe
} from "react-icons/fa";

import allMinistries from "./MinistryDetails/data/ministries";

const ministries = Object.values(allMinistries);

// Nombre de responsables réellement enregistrés, tous ministères
// confondus. Sans aucun responsable saisi, on n'affiche pas « 0 » :
// mieux vaut une formule honnête qu'un chiffre décourageant.
const leaderCount = ministries.reduce(
  (total, item) => total + (item.leaders?.length ?? 0),
  0
);

// Ces deux chiffres étaient écrits en dur : « + 10 Ministères actifs »
// alors qu'il y en a six, et « + 300 Serviteurs engagés ». Le premier
// affichait donc une information fausse, que personne ne pensait à
// corriger en ajoutant ou retirant un ministère.
const stats = [
  {
    icon: <FaUsers />,
    value: String(ministries.length),
    label:
      ministries.length > 1
        ? "Ministères actifs"
        : "Ministère actif",
    color: "green",
  },
  {
    icon: <FaHandsHelping />,
    value: leaderCount > 0 ? String(leaderCount) : "Nombreux",
    label: "Responsables engagés",
    color: "gold",
  },
  {
    icon: <FaHeart />,
    value: "Des milliers",
    label: "de vies impactées",
    color: "green",
  },
  {
    icon: <FaGlobe />,
    value: "Un seul but :",
    label: "Gloire à Dieu",
    color: "gold",
  },
];

const MinistriesStats = () => {
  return (
    <section className="ministries-stats">
      <div className="ministries-stats__container">

        {stats.map((stat, index) => (
          <div
            key={index}
            className="ministries-stat"
          >
            <div
              className={`ministries-stat__icon ministries-stat__icon--${stat.color}`}
            >
              {stat.icon}
            </div>

            <div className="ministries-stat__content">
              <h3>{stat.value}</h3>
              <p>{stat.label}</p>
            </div>
          </div>
        ))}

      </div>
    </section>
  );
};

export default MinistriesStats;