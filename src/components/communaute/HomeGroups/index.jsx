import { motion } from "framer-motion";

import { Link } from "react-router-dom";

import {
  FaClock,
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
    <section className="home-groups">
      <div className="home-groups__container">
        <header className="home-groups__header">
          <span className="home-groups__eyebrow">
            Groupes de maison
          </span>

          <h2>Une église près de chez vous</h2>

          <div
            className="home-groups__line"
            aria-hidden="true"
          ></div>

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
              <span className="home-groups__district">
                {group.district}
              </span>

              <h3>{group.name}</h3>

              <p className="home-groups__focus">{group.focus}</p>

              <dl className="home-groups__meta">
                <div>
                  <dt>
                    <FaClock aria-hidden="true" />
                    <span className="sr-only">Horaire</span>
                  </dt>

                  <dd>
                    {group.day}, {group.time}
                  </dd>
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

        <p className="home-groups__note">
          L&apos;adresse exacte du foyer est communiquée après un premier
          contact.{" "}
          <Link to="/contact">Écrivez-nous</Link> pour être mis en relation.
        </p>
      </div>
    </section>
  );
};

export default HomeGroups;
