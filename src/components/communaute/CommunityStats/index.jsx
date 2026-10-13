import { useEffect, useRef, useState } from "react";

import { motion, useInView } from "framer-motion";

import {
  FaUsers,
  FaHandsHelping,
  FaMapMarkedAlt,
  FaChurch,
} from "react-icons/fa";

import { communityStats } from "../../../content/community";

import "./CommunityStats.scss";

// Compteur qui s'anime une seule fois, à l'entrée dans le champ de
// vision.
//
// `prefers-reduced-motion` est respecté : le chiffre final s'affiche
// alors directement. Une animation de nombre qui défile est exactement
// le genre d'effet qui gêne les personnes sensibles au mouvement.
const useCountUp = (target, active, duration = 1600) => {
  const [value, setValue] = useState(0);

  // Lu une seule fois, à l'initialisation. Le placer ici plutôt que
  // dans l'effet évite d'y appeler `setValue` pour le cas « pas
  // d'animation » : la valeur finale est alors simplement dérivée au
  // rendu, sans passer par un état intermédiaire.
  const [reduced] = useState(
    () =>
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const animated = active && !reduced && target > 0;

  useEffect(() => {
    if (!animated) return undefined;

    let frame;

    const start = performance.now();

    // Décélération : le compteur part vite puis se pose sur sa valeur,
    // au lieu d'avancer d'un pas mécanique.
    const ease = (t) => 1 - Math.pow(1 - t, 3);

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);

      setValue(Math.round(ease(progress) * target));

      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [target, animated, duration]);

  if (!active) return 0;

  // Mouvement réduit, ou rien à compter : la valeur finale, tout de
  // suite.
  return animated ? value : target;
};

const StatCard = ({ icon, value, label, hint, active, index }) => {
  const shown = useCountUp(value, active);

  return (
    <motion.li
      className="community-stats__item"
      initial={{ opacity: 0, y: 16 }}
      animate={
        active ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }
      }
      transition={{
        duration: 0.45,
        delay: index * 0.1,
        ease: "easeOut",
      }}
    >
      <span className="community-stats__icon" aria-hidden="true">
        {icon}
      </span>

      <span className="community-stats__figures">
        <span className="community-stats__value">
          {shown}
          <span className="community-stats__plus" aria-hidden="true">
            +
          </span>
        </span>

        <span className="community-stats__label">{label}</span>

        <span className="community-stats__hint">{hint}</span>
      </span>
    </motion.li>
  );
};

const CommunityStats = () => {
  const ref = useRef(null);

  // `once` : une fois comptés, les chiffres ne se rejouent pas à chaque
  // aller-retour de défilement.
  const inView = useInView(ref, { once: true, amount: 0.3 });

  const cards = [
    {
      key: "members",
      icon: <FaUsers />,
      value: communityStats.members,
      label: "Membres",
      hint: "Engagés dans la vie de l'église",
    },
    {
      key: "servants",
      icon: <FaHandsHelping />,
      value: communityStats.servants,
      label: "Serviteurs",
      hint: "Responsables et bénévoles",
    },
    {
      key: "ministries",
      icon: <FaChurch />,
      value: communityStats.ministries,
      label: "Ministères",
      hint: "Chacun avec sa mission",
    },
    {
      key: "districts",
      icon: <FaMapMarkedAlt />,
      value: communityStats.districts,
      label: "Quartiers",
      hint: "Où vivent nos membres",
    },
  ].filter((card) => card.value > 0);

  // Il faut au moins deux chiffres pour parler de « chiffres ».
  //
  // Le registre se remplit progressivement : tant qu'une seule rubrique
  // dépasse son seuil, un bandeau titré « notre communauté en chiffres »
  // autour d'une carte unique fait plus pauvre que pas de bandeau du
  // tout. La section réapparaîtra d'elle-même à mesure que les membres
  // seront saisis.
  if (cards.length < 2) return null;

  return (
    <section
      className="community-stats"
      ref={ref}
      aria-labelledby="community-stats-title"
    >
      <div className="community-stats__container">
        <div className="community-stats__panel">
          <header className="community-stats__header">
            <span className="community-stats__eyebrow">
              En chiffres
            </span>

            <h2 id="community-stats-title">Une famille qui grandit</h2>

            <p>Issus de notre registre, mis à jour à chaque publication.</p>
          </header>

          <ul className="community-stats__list">
            {cards.map((card, index) => (
              <StatCard
                key={card.key}
                icon={card.icon}
                value={card.value}
                label={card.label}
                hint={card.hint}
                active={inView}
                index={index}
              />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default CommunityStats;
