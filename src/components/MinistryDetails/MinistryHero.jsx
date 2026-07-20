import { Link } from "react-router-dom";

import { FaUsers, FaEnvelope } from "react-icons/fa";

import "./MinistryHero.scss";

import MinistryStats from "./MinistryStats";

const MinistryHero = ({
  ministry,
}) => {
  return (
    <section className="ministry-hero">

      <img
        src={ministry.image}
        alt={ministry.title}
        className="ministry-hero__image"
      />

      <div className="ministry-hero__overlay" />

      <div className="ministry-hero__content">

        <span className="ministry-hero__badge">
          Ministère
        </span>

        <h1 className="ministry-hero__title">
          {ministry.title}
        </h1>

        <p className="ministry-hero__description">
          {ministry.description}
        </p>

        <div className="ministry-hero__stats">

          <MinistryStats
            stats={ministry.stats || []}
            insideHero
          />

        </div>

        <div className="ministry-hero__actions">

          <Link to="/contact" className="btn-primary">
            <FaUsers aria-hidden="true" />
            Rejoindre le ministère
          </Link>

          <Link to="/contact" className="btn-outline">
            <FaEnvelope aria-hidden="true" />
            Nous contacter
          </Link>

        </div>

      </div>

    </section>
  );
};

export default MinistryHero;