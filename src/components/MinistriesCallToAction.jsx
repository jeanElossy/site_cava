import { Link } from "react-router-dom";

import { HiArrowRight } from "react-icons/hi";

import "./MinistriesCallToAction.scss";

import ctaImage from "../assets/images/ministry-cta.jpg";

const MinistriesCallToAction = () => {
  return (
    <section
      className="ministries-cta"
      aria-labelledby="ministries-cta-title"
    >
      <div className="ministries-cta__container">
        <div className="ministries-cta__content">
          <span className="ministries-cta__eyebrow">S&apos;engager</span>

          <h2 id="ministries-cta-title">Dieu a un appel pour chacun.</h2>

          <p>
            Découvrez le ministère où vous pouvez servir et impacter des
            vies. Dites-nous ce qui vous anime : nous vous orienterons vers
            l&apos;équipe qui vous correspond.
          </p>

          <div className="ministries-cta__actions">
            <Link
              to="/contact"
              className="ministries-cta__button"
            >
              Je veux m&apos;impliquer
              <HiArrowRight aria-hidden="true" />
            </Link>

            <Link
              to="/appel-a-candidature"
              className="ministries-cta__button ministries-cta__button--ghost"
            >
              Postes ouverts
            </Link>
          </div>
        </div>

        <div className="ministries-cta__image">
          <img
            src={ctaImage}
            alt="Des mains réunies, signe d'un service partagé"
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
    </section>
  );
};

export default MinistriesCallToAction;
