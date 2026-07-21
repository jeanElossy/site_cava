import {
  Users,
  Heart,
  BookOpen,
  Globe,
  ArrowRight,
} from "lucide-react";

import { Link } from "react-router-dom";

import allMinistries from "../MinistryDetails/data/ministries";

import "./Ministries.scss";

// Les quatre premiers ministères, lus depuis les données réelles.
//
// Cette liste était auparavant recopiée en dur ici, avec ses propres
// titres, descriptions et liens. C'est exactement la duplication que
// CLAUDE.md signale : renommer un ministère dans l'administration
// laissait l'accueil afficher l'ancien libellé, et modifier un slug
// menait au message « Ministère introuvable ».
//
// Les ministères sont déjà triés par `order` côté API.
const ICONS = [Users, Heart, BookOpen, Globe];

// La couleur alterne pour conserver le rythme visuel d'origine, que le
// champ `color` du modèle (vert ou doré) ne reproduit pas exactement.
const cardColor = (index) => (index % 2 === 0 ? "green" : "yellow");

const Ministries = () => {
  const featured = Object.values(allMinistries).slice(0, 4);


  return (
    <section className="ministries">

      <div className="ministries__left">

        <span className="section-tag">
          NOS MINISTÈRES
        </span>

        <h2>
          Des ministères pour
          bâtir des vies
        </h2>

        <div className="line"></div>

        <p>
          Découvrez les différents ministères où chacun
          peut servir, grandir et impacter pour le Royaume.
        </p>

        <Link
          to="/ministries"
          className="ministries-btn"
        >
          Découvrir tous les ministères
          <ArrowRight size={18} />
        </Link>

      </div>

      <div className="ministries__grid">

        {featured.map((item, index) => {
          const Icon = ICONS[index % ICONS.length];

          return (
            <div
              className="card"
              key={item.slug}
            >

              <div className={`icon ${cardColor(index)}`}>
                <Icon />
              </div>

              <h3>{item.title}</h3>

              <p>{item.description}</p>

              <Link
                to={`/ministries/${item.slug}`}
                className="card-link"
              >
                En savoir plus
                <ArrowRight size={16} />
              </Link>

            </div>
          );
        })}

      </div>

    </section>
  );
};

export default Ministries;