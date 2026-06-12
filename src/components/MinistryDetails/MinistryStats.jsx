import {
  FaUsers,
  FaCalendarAlt,
  FaUserTie,
  FaStar,
} from "react-icons/fa";

import "./MinistryStats.scss";

const iconMap = {
  users: <FaUsers />,
  calendar: <FaCalendarAlt />,
  leaders: <FaUserTie />,
  star: <FaStar />,
};

const MinistryStats = ({
  stats = [],
  insideHero = false,
}) => {
  return (
    <section
      className={`ministry-stats ${
        insideHero
          ? "ministry-stats--hero"
          : ""
      }`}
    >
      <div className="container">

        {stats.length > 0 ? (
          stats.map(
            (
              stat,
              index
            ) => (
              <div
                key={index}
                className="stat-card"
              >
                <div className="stat-card__icon">
                  {iconMap[stat.icon]}
                </div>

                <h3>
                  {stat.value}
                </h3>

                <span>
                  {stat.label}
                </span>
              </div>
            )
          )
        ) : (
          <div className="stat-card">

            <h3>
              —
            </h3>

            <span>
              Aucune statistique
            </span>

          </div>
        )}

      </div>
    </section>
  );
};

export default MinistryStats;