import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  FaGraduationCap,
  FaPrayingHands,
  FaHandHoldingHeart,
  FaHands,
  FaCoins,
  FaFileSignature,
} from "react-icons/fa";
import { HiArrowRight } from "react-icons/hi";

import positions from "../data/positions";
import { useReveal, useHoverLift } from "../motion";

import "./OpenPositions.scss";

// L'icône est un choix d'habillage, pas une donnée : le module de
// données ne porte qu'une clé, la correspondance vit ici — même
// séparation que `MinistriesGrid`, qui garde ses icônes hors du modèle.
const ICONS = {
  graduation: FaGraduationCap,
  prayer: FaPrayingHands,
  flock: FaHandHoldingHeart,
  worship: FaHands,
  finance: FaCoins,
  secretariat: FaFileSignature,
};

const OpenPositions = () => {
  const reveal = useReveal();
  const lift = useHoverLift();

  return (
    <section className="open-positions" id="postes">
      <div className="open-positions__container">
        <motion.h2 className="open-positions__title" {...reveal()}>
          Postes <span>recherchés</span>
        </motion.h2>

        <motion.p className="open-positions__subtitle" {...reveal(1)}>
          Découvrez les différents domaines où vous pouvez servir au sein
          de ÇA.VA.
        </motion.p>

        <ul className="open-positions__grid">
          {positions.map((position, index) => {
            const Icon = ICONS[position.icon] ?? FaHands;

            return (
              <motion.li
                key={position.id}
                className={`open-positions__card open-positions__card--${position.variant}`}
                {...reveal(index)}
                {...lift}
              >
                <span className="open-positions__icon" aria-hidden="true">
                  <Icon />
                </span>

                <h3 className="open-positions__card-title">
                  {position.title}
                </h3>

                <p className="open-positions__card-subtitle">
                  {position.subtitle}
                </p>

                {/* Un LIEN, pas un bouton qui dispatcherait : le poste
                    voyage dans l'URL, comme le type de don sur /donate.
                    Un seul mécanisme de préremplissage à maintenir, et
                    le lien reste partageable. */}
                <Link
                  className="open-positions__link"
                  to={`/appel-a-candidature?poste=${position.id}#candidature-formulaire`}
                >
                  Voir les postes
                  <HiArrowRight aria-hidden="true" />
                  <span className="open-positions__sr">
                    {` — ${position.title}`}
                  </span>
                </Link>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};

export default OpenPositions;
