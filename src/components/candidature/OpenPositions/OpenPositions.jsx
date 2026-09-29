import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { HiArrowRight } from "react-icons/hi";

import usePositions from "../usePositions";
import { iconFor, variantFor } from "../positionIcons";
import { useReveal, useHoverLift } from "../motion";

import "./OpenPositions.scss";

const OpenPositions = () => {
  const reveal = useReveal();
  const lift = useHoverLift();
  const { positions, isLoading, error } = usePositions();

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

        {isLoading && (
          <p className="open-positions__state" role="status">
            Chargement des postes…
          </p>
        )}

        {/* Un échec de chargement se DIT. Laisser la section vide
            laisserait croire qu'aucun poste n'est ouvert, ce qui est un
            message différent — et faux. */}
        {!isLoading && error && (
          <p className="open-positions__state" role="alert">
            {error}
          </p>
        )}

        {!isLoading && !error && positions.length === 0 && (
          <p className="open-positions__state">
            Aucun poste n&apos;est ouvert pour le moment.
          </p>
        )}

        {positions.length > 0 && (
          <ul className="open-positions__grid">
            {positions.map((position, index) => {
              const Icon = iconFor(position.icon);

              return (
                <motion.li
                  key={position.id ?? position.slug}
                  className={`open-positions__card open-positions__card--${variantFor(
                    position.variant
                  )}`}
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
                    {position.subtitle || " "}
                  </p>

                  {/* Mène désormais à la FICHE du poste, et non plus
                      directement au formulaire : le visiteur doit
                      pouvoir lire ce qu'on attend de lui avant de
                      candidater. Le lien vers le formulaire, prérempli,
                      est sur la fiche. */}
                  <Link
                    className="open-positions__link"
                    to={`/appel-a-candidature/${position.slug}`}
                  >
                    Voir le poste
                    <HiArrowRight aria-hidden="true" />
                    <span className="open-positions__sr">
                      {` — ${position.title}`}
                    </span>
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};

export default OpenPositions;
