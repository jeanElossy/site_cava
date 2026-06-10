import "./MinistriesStats.scss";

import {
  FaUsers,
  FaHandsHelping,
  FaHeart,
  FaGlobe
} from "react-icons/fa";

const stats = [
  {
    icon: <FaUsers />,
    value: "+ 10",
    label: "Ministères actifs",
    color: "green",
  },
  {
    icon: <FaHandsHelping />,
    value: "+ 300",
    label: "Serviteurs engagés",
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