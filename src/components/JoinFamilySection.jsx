import { Link } from "react-router-dom";

import { HiArrowRight } from "react-icons/hi";

import "./JoinFamilySection.scss";

import familyImage from "../assets/images/family.jpg";

const JoinFamilySection = () => {
  return (
    <section
      className="join-family"
      aria-labelledby="join-family-title"
    >
      <div className="join-family__container">
        <div className="join-family__content">
          <span className="join-family__eyebrow">Nous rejoindre</span>

          <h2 id="join-family-title">Rejoignez la famille CAVA</h2>

          <p>
            Nous serions honorés de vous accueillir parmi nous. Venez à un
            culte, rencontrez la communauté, et trouvez votre place.
          </p>

          <div className="join-family__actions">
            <Link
              to="/inscription"
              className="join-family__button"
            >
              Devenir membre
              <HiArrowRight aria-hidden="true" />
            </Link>

            <Link
              to="/contact"
              className="join-family__button join-family__button--ghost"
            >
              Nous contacter
            </Link>
          </div>
        </div>

        <div className="join-family__image">
          <img
            src={familyImage}
            alt="Membres de la famille CAVA réunis"
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
    </section>
  );
};

export default JoinFamilySection;
