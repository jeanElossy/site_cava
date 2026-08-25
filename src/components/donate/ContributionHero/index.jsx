import "./ContributionHero.scss";
import {
  FaChurch,
  FaHeart,
} from "react-icons/fa";

import donateImg from "../../../assets/images/donation-hero.jpg";

const ContributionHero = () => {
  return (
    <section className="contribution-hero">

      {/* CALQUES DE FOND, en dehors de `__container`.
          `__container` est centré et plafonné à 1400 px : une image
          absolue placée dedans se cale sur LUI, pas sur le hero, et
          n'atteignait donc pas les bords de l'écran au-delà de cette
          largeur. */}
      <div className="contribution-hero__right">
        <img
          src={donateImg}
          alt=""
          aria-hidden="true"
        />
      </div>

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

          {/*
            Le formulaire de contribution est plus bas sur la même page :
            le bouton y renvoie par ancre.
          */}
          <a href="#contribution-form">
            <FaHeart aria-hidden="true" />
            Contribuer maintenant
          </a>

        </div>

      </div>

    </section>
  );
};

export default ContributionHero;