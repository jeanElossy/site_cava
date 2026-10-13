import { FaArrowRight, FaMapMarkerAlt } from "react-icons/fa";

import { site } from "../content/settings";

import "./VisitMap.scss";

import mapBackground from "../assets/images/map-background.jpg";

// Le bouton « Voir l'itinéraire » menait à https://maps.google.com, sans
// adresse : le visiteur arrivait sur une carte du monde. Il ouvre
// désormais une recherche sur l'adresse de l'église (paramètres du site).
const destination = `${site.churchName}, ${site.address.trim()}, Abidjan, Côte d'Ivoire`;

const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  destination
)}`;

const VisitMap = () => {
  return (
    <section
      className="visit-map"
      aria-labelledby="visit-map-title"
    >
      <div className="visit-map__container">
        <div className="visit-map__card">
          {/* Illustration : ce n'est pas une carte interactive, d'où le
              texte alternatif vide. */}
          <img
            src={mapBackground}
            alt=""
            className="visit-map__bg"
            loading="lazy"
            decoding="async"
          />

          <div
            className="visit-map__overlay"
            aria-hidden="true"
          />

          <div className="visit-map__content">
            <div className="visit-map__left">
              <span className="visit-map__eyebrow">Nous trouver</span>

              <h2 id="visit-map-title">Venez nous rendre visite</h2>

              <p>
                Nous serions ravis de vous accueillir lors de nos cultes et
                événements.
              </p>

              <a
                className="visit-map__cta"
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Voir l&apos;itinéraire
                <FaArrowRight aria-hidden="true" />
              </a>
            </div>

            <address className="visit-map__badge">
              <FaMapMarkerAlt aria-hidden="true" />

              <div>
                <strong>{site.churchName}</strong>

                <span>{site.address.trim()}</span>

                <span>Abidjan, Côte d&apos;Ivoire</span>
              </div>
            </address>
          </div>
        </div>
      </div>
    </section>
  );
};

export default VisitMap;
