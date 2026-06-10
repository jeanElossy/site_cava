import "./StatsSection.scss";

import {
  HiUsers,
  HiHome,
  HiShieldCheck,
  HiHeart,
} from "react-icons/hi";

const stats = [
  {
    icon: <HiUsers />,
    value: "+ 1500",
    label: "Vies impactées",
  },
  {
    icon: <HiHome />,
    value: "+ 25",
    label: "Groupes de maison",
  },
  {
    icon: <HiShieldCheck />,
    value: "+ 30",
    label: "Bénévoles engagés",
  },
  {
    icon: <HiHeart />,
    value: "+ 10",
    label: "Années de ministère",
  },
];

const StatsSection = () => {
  return (
    <section className="stats-section">
      <div className="stats-section__container">

        {stats.map((stat, index) => (
          <div
            key={index}
            className="stat-item"
          >
            <div className="stat-item__icon">
              {stat.icon}
            </div>

            <div className="stat-item__content">
              <h3>{stat.value}</h3>
              <p>{stat.label}</p>
            </div>
          </div>
        ))}

      </div>
    </section>
  );
};

export default StatsSection;