import { Link } from "react-router-dom";

import {
  FaArrowRight,
  FaHeart,
} from "react-icons/fa";

import phoneNewsletter from "../../assets/images/phone-newsletter.png";

import CalendarWidget from "../CalendarWidget";

import "./EventsSidebar.scss";

/**
 * Colonne de droite de la page Événements : calendrier, encart newsletter
 * et encart « Un événement à proposer ? ».
 *
 * Ces trois blocs vivaient auparavant dans `UpcomingEvents`, qui portait
 * lui-même une grille à deux colonnes. La page en définissant une seconde
 * (`.events-layout`), la mise en page se retrouvait imbriquée deux fois et
 * la liste était comprimée dans 60 % de la largeur. La grille appartient
 * désormais à la page, chaque composant ne remplissant qu'une colonne.
 */
const EventsSidebar = () => {
  return (
    <aside
      className="events-sidebar"
      aria-label="Calendrier et informations complémentaires"
    >
      {/* CalendarWidget porte déjà sa propre carte et son titre :
          pas de conteneur supplémentaire, qui doublerait bordure,
          padding et intitulé « Calendrier ». */}
      <CalendarWidget />

      <div className="events-sidebar__newsletter">
        <div className="events-sidebar__newsletter-content">
          <h2>Ne manquez aucun événement !</h2>

          <span aria-hidden="true" />

          <p>
            Abonnez-vous à notre newsletter pour recevoir toutes les
            actualités et invitations.
          </p>

          <Link to="/contact">
            S'abonner
            <FaArrowRight aria-hidden="true" />
          </Link>
        </div>

        <img
          src={phoneNewsletter}
          alt=""
          aria-hidden="true"
        />
      </div>

      <div className="events-sidebar__proposal">
        <div
          className="events-sidebar__proposal-icon"
          aria-hidden="true"
        >
          <FaHeart />
        </div>

        <div>
          <h2>Un événement à proposer ?</h2>

          <p>
            Vous souhaitez organiser un événement au sein de notre
            église ?
          </p>

          <Link to="/contact">
            Nous contacter
            <FaArrowRight aria-hidden="true" />
          </Link>
        </div>
      </div>
    </aside>
  );
};

export default EventsSidebar;
