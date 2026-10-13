import { motion } from "framer-motion";

import { Link } from "react-router-dom";

import {
  FaArrowRight,
  FaBookOpen,
  FaMapMarkerAlt,
  FaUserFriends,
} from "react-icons/fa";

import "./HomeGroups.scss";

// Contenu éditorial : les groupes de maison ne sont pas gérés depuis
// l'administration pour l'instant (aucune collection dédiée dans
// `services/api.js`). À basculer vers l'API le jour où le client
// souhaitera les modifier lui-même.
const groups = [
  {
    id: "angre",
    name: "Groupe Angré Château",
    district: "Angré Château",
    day: "Mardi",
    time: "19h00 - 20h30",
    host: "Famille Koffi",
    focus: "Étude de la Parole et prière",
  },
  {
    id: "cocody",
    name: "Groupe Cocody Centre",
    district: "Cocody",
    day: "Mercredi",
    time: "18h30 - 20h00",
    host: "Famille N'Guessan",
    focus: "Discipulat des nouveaux venus",
  },
  {
    id: "yopougon",
    name: "Groupe Yopougon",
    district: "Yopougon",
    day: "Jeudi",
    time: "19h00 - 20h30",
    host: "Famille Aka",
    focus: "Familles et couples",
  },
  {
    id: "abobo",
    name: "Groupe Abobo",
    district: "Abobo",
    day: "Vendredi",
    time: "18h00 - 19h30",
    host: "Famille Bamba",
    focus: "Jeunes adultes et étudiants",
  },
];

const HomeGroups = () => {
  return (
    <section
      className="home-groups"
      id="groupes"
      aria-labelledby="home-groups-title"
    >
      <div className="home-groups__container">
        <header className="home-groups__header">
          <div>
            <span className="home-groups__eyebrow">
              Groupes de maison
            </span>

            <h2 id="home-groups-title">Une église près de chez vous</h2>
          </div>

          <p>
            Chaque semaine, des foyers ouvrent leur porte pour un temps de
            partage, de prière et d&apos;étude biblique. Rejoignez le groupe
            le plus proche de votre quartier.
          </p>
        </header>

        <ul className="home-groups__grid">
          {groups.map((group, index) => (
            <motion.li
              key={group.id}
              className="home-groups__card"
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{
                duration: 0.45,
                delay: index * 0.07,
              }}
            >
              <p className="home-groups__when">
                <span className="home-groups__day">{group.day}</span>
                <span className="home-groups__time">{group.time}</span>
              </p>

              <h3>{group.name}</h3>

              <dl className="home-groups__meta">
                <div>
                  <dt>
                    <FaBookOpen aria-hidden="true" />
                    <span className="sr-only">Thème</span>
                  </dt>

                  <dd>{group.focus}</dd>
                </div>

                <div>
                  <dt>
                    <FaMapMarkerAlt aria-hidden="true" />
                    <span className="sr-only">Quartier</span>
                  </dt>

                  <dd>{group.district}, Abidjan</dd>
                </div>

                <div>
                  <dt>
                    <FaUserFriends aria-hidden="true" />
                    <span className="sr-only">Foyer d&apos;accueil</span>
                  </dt>

                  <dd>{group.host}</dd>
                </div>
              </dl>
            </motion.li>
          ))}
        </ul>

        <div className="home-groups__note">
          <p>
            L&apos;adresse exacte du foyer est communiquée après un premier
            contact. Pas de groupe près de chez vous&nbsp;? Dites-le-nous.
          </p>

          <Link
            to="/contact"
            className="home-groups__note-link"
          >
            Être mis en relation
            <FaArrowRight aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default HomeGroups;
