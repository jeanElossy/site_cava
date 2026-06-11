import "./VisitMap.scss";

import {
  FaMapMarkerAlt,
  FaArrowRight,
} from "react-icons/fa";

import mapBackground from "../assets/images/map-background.jpg";

const VisitMap = () => {
  return (
    <section className="visit-map">
      <div className="visit-map__container">

        <img
          src={mapBackground}
          alt="Carte localisation"
          className="visit-map__bg"
        />

        <div className="visit-map__overlay" />

        <div className="visit-map__content">

          <div className="visit-map__left">

            <div className="visit-map__icon">
              <FaMapMarkerAlt />
            </div>

            <div>
              <h2>Venez nous rendre visite !</h2>

              <div className="visit-map__line" />

              <p>
                Nous serions ravis de vous accueillir lors
                de nos cultes et événements.
              </p>

              <a
                href="https://maps.google.com"
                target="_blank"
                rel="noreferrer"
              >
                Voir l'itinéraire

                <FaArrowRight />
              </a>
            </div>

          </div>

          <div className="visit-map__badge">

            <FaMapMarkerAlt />

            <div>
              <strong>
                CAVA – Centre Apostolique
                Vie et Abondance
              </strong>

              <span>
                Abidjan, Côte d'Ivoire
              </span>
            </div>

          </div>

        </div>
      </div>
    </section>
  );
};

export default VisitMap;