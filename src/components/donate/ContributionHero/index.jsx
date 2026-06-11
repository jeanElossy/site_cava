import "./ContributionHero.scss";
import {
  FaChurch,
  FaHeart,
} from "react-icons/fa";

import donateImg from "../../../assets/images/donation-hero.jpg";

const ContributionHero = () => {
  return (
    <section className="contribution-hero">

      <div className="contribution-hero__overlay" />

      <div className="contribution-hero__container">

        <div className="contribution-hero__left">

          <span className="badge">
            <FaChurch />
            Dîmes • Offrandes • Contributions
          </span>

          <h1>
            Contribuez à l'œuvre
            de Dieu
          </h1>

          <div className="hero-line" />

          <p>
            Vos dîmes, offrandes et contributions
            soutiennent l'évangélisation,
            l'action sociale, la formation
            biblique et le développement
            des projets de l'église.
          </p>

          <button>
            <FaHeart />
            Contribuer maintenant
          </button>

        </div>

        <div className="contribution-hero__right">

          <img
            src={donateImg}
            alt="Contribution"
          />

        </div>

      </div>

    </section>
  );
};

export default ContributionHero;