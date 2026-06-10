import "./MinistriesCallToAction.scss";

import { FaUsers } from "react-icons/fa";
import { HiArrowRight } from "react-icons/hi";

import ctaImage from "../assets/images/ministry-cta.jpg";

const MinistriesCallToAction = () => {
  return (
    <section className="ministries-cta">
      <div className="ministries-cta__container">

        <div className="ministries-cta__content">

          <div className="ministries-cta__icon">
            <FaUsers />
          </div>

          <div className="ministries-cta__text">

            <h2>Dieu a un appel pour chacun.</h2>

            <p>
              Découvrez le ministère où vous pouvez servir
              et impacter des vies.
            </p>

            <button>
              Je veux m'impliquer
              <HiArrowRight />
            </button>

          </div>

        </div>

        <div className="ministries-cta__image">
          <img
            src={ctaImage}
            alt="Servir dans un ministère"
          />
        </div>

      </div>
    </section>
  );
};

export default MinistriesCallToAction;