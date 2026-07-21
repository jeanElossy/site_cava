import "./MinistryContacts.scss";

import {
  FaUsers,
  FaHandsHelping,
  FaBookOpen,
  FaHome,
  FaHeart,
  FaGlobeAfrica,
  FaArrowRight,
} from "react-icons/fa";

import allMinistries from "./MinistryDetails/data/ministries";
import { site } from "../content/settings";

const ICONS = [
  <FaUsers />,
  <FaHeart />,
  <FaBookOpen />,
  <FaHome />,
  <FaHandsHelping />,
  <FaGlobeAfrica />,
];

// La liste et les adresses étaient écrites en dur. Un ministère ajouté
// ou renommé dans l'administration n'apparaissait pas ici, et les
// adresses affichées n'existaient nulle part ailleurs.
//
// L'adresse vient maintenant du champ `contactEmail` du ministère ;
// à défaut, celle de l'église, qui a le mérite d'aboutir réellement.
const ministries = Object.values(allMinistries).map(
  (item, index) => ({
    slug: item.slug,
    title: item.title,
    description: item.description,
    email: item.contactEmail?.trim() || site.email,
    icon: ICONS[index % ICONS.length],
    color: index % 2 === 0 ? "green" : "gold",
  })
);

const MinistryContacts = () => {
  return (
    <section className="ministry-contacts">
      <div className="ministry-contacts__container">
        <div className="ministry-contacts__header">
          <h2>Contactez un ministère</h2>

          <p>
            Besoin d'informations spécifiques ? Contactez directement le
            ministère concerné.
          </p>
        </div>

        <div className="ministry-contacts__grid">
          {ministries.map((ministry) => (
            <div
              className="ministry-card"
              key={ministry.slug}
            >
              <div
                className={`ministry-card__icon ministry-card__icon--${ministry.color}`}
              >
                {ministry.icon}
              </div>

              <h3>{ministry.title}</h3>

              <p>{ministry.description}</p>

              <a href={`mailto:${ministry.email}`}>
                {ministry.email}
                <FaArrowRight />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default MinistryContacts;