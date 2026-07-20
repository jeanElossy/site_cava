import { Link } from "react-router-dom";

import "./JoinFamilySection.scss";

import familyImage from "../assets/images/family.jpg";
import { HiArrowRight } from "react-icons/hi";

const JoinFamilySection = () => {
  return (
    <section className="join-family">
      <div className="join-family__container">

        <div className="join-family__content">
          <h2>
            Rejoignez la famille
            <br />
            CAVA
          </h2>

          <p>
            Nous serions honorés de vous accueillir parmi nous.
          </p>

          <Link
            to="/contact"
            className="join-family__button"
          >
            Nous contacter
            <HiArrowRight aria-hidden="true" />
          </Link>
        </div>

        <div className="join-family__image">
          <img
            src={familyImage}
            alt="Famille CAVA"
          />
        </div>

      </div>
    </section>
  );
};

export default JoinFamilySection;