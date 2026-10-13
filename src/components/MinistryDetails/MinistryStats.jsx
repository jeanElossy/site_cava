import {
  FaUsers,
  FaCalendarAlt,
  FaUserTie,
  FaStar,
} from "react-icons/fa";

import "./MinistryStats.scss";

const ICONS = {
  users: FaUsers,
  calendar: FaCalendarAlt,
  leaders: FaUserTie,
  star: FaStar,
};

// Chiffres d'un ministère, saisis dans l'administration. Bandeau blanc
// qui chevauche le bas du hero ; sans chiffre, il ne s'affiche pas (il
// affichait auparavant une carte « — Aucune statistique »).
const MinistryStats = ({ stats = [] }) => {
  if (stats.length === 0) return null;

  return (
    <section
      className="ministry-stats"
      aria-label="Le ministère en chiffres"
    >
      <div className="ministry-stats__container">
        <ul className="ministry-stats__panel">
          {stats.map((stat, index) => {
            const Icon = ICONS[stat.icon] ?? FaStar;

            return (
              <li
                key={`${stat.label}-${index}`}
                className="ministry-stats__item"
              >
                <span
                  className="ministry-stats__icon"
                  aria-hidden="true"
                >
                  <Icon />
                </span>

                <span className="ministry-stats__figures">
                  <span className="ministry-stats__value">{stat.value}</span>
                  <span className="ministry-stats__label">{stat.label}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};

export default MinistryStats;
