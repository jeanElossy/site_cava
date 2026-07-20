import { Link } from "react-router-dom";

import "./CommunityHero.scss";

import heroImage from "../../../assets/images/homegroup.jpg";

const CommunityHero = () => {
  return (
    <section
      className="community-hero"
      style={{
        backgroundImage: `url(${heroImage})`,
      }}
    >
      <div
        className="community-hero__overlay"
        aria-hidden="true"
      ></div>

      <div className="community-hero__container">
        <div className="community-hero__content">
          <nav
            className="community-hero__breadcrumb"
            aria-label="Fil d'Ariane"
          >
            <Link to="/">Accueil</Link>

            <span aria-hidden="true">/</span>

            <span aria-current="page">Communauté</span>
          </nav>

          <h1>Notre communauté</h1>

          <h2>
            Une famille où l&apos;on grandit
            <br />
            ensemble, jamais seul.
          </h2>

          <div
            className="community-hero__line"
            aria-hidden="true"
          ></div>

          <blockquote>
            « Ils persévéraient dans l&apos;enseignement des apôtres,
            dans la communion fraternelle, dans la fraction du pain et
            dans les prières. »
          </blockquote>

          <p>Actes 2:42</p>
        </div>
      </div>
    </section>
  );
};

export default CommunityHero;
