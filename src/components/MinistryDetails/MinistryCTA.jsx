import { Link } from "react-router-dom";

import { FaArrowRight } from "react-icons/fa";

import "./MinistryCTA.scss";

const MinistryCTA = ({ ministry }) => {
  return (
    <section
      className="ministry-cta"
      aria-labelledby="ministry-cta-title"
    >
      <div className="ministry-cta__container">
        <span className="ministry-cta__eyebrow">Servir avec nous</span>

        <h2 id="ministry-cta-title">
          Rejoignez le ministère {ministry.title}
        </h2>

        <p>
          Découvrez votre appel et servez avec nous pour impacter des vies et
          faire avancer le Royaume de Dieu.
        </p>

        <div className="ministry-cta__actions">
          <Link
            to="/contact"
            className="ministry-cta__button"
          >
            Rejoindre maintenant
            <FaArrowRight aria-hidden="true" />
          </Link>

          <Link
            to="/ministries"
            className="ministry-cta__button ministry-cta__button--ghost"
          >
            Voir les autres ministères
          </Link>
        </div>
      </div>
    </section>
  );
};

export default MinistryCTA;
