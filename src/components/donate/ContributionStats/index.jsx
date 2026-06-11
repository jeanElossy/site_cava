import "./ContributionStats.scss";
import {
  FaDonate,
  FaUsers,
  FaChurch,
  FaHandsHelping
} from "react-icons/fa";

const ContributionStats = () => {
  return (
    <section className="contribution-stats">

      <div className="stat-card">
        <div className="stat-icon">
          <FaDonate />
        </div>

        <strong>18.5M</strong>

        <span>FCFA collectés</span>
      </div>

      <div className="stat-card">
        <div className="stat-icon">
          <FaUsers />
        </div>

        <strong>1 284</strong>

        <span>Contributeurs</span>
      </div>

      <div className="stat-card">
        <div className="stat-icon">
          <FaChurch />
        </div>

        <strong>12</strong>

        <span>Projets réalisés</span>
      </div>

      <div className="stat-card">
        <div className="stat-icon">
          <FaHandsHelping />
        </div>

        <strong>145</strong>

        <span>Actions menées</span>
      </div>

    </section>
  );
};

export default ContributionStats;