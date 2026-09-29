import { motion } from "framer-motion";
import { FaUsers, FaHeart, FaChartBar } from "react-icons/fa";
import { HiArrowRight } from "react-icons/hi";

import { useReveal, useHoverLift } from "../motion";

import "./CandidatureCta.scss";

const CLAIMS = [
  { icon: FaUsers, text: "Vous avez des compétences ?" },
  { icon: FaHeart, text: "Vous avez un cœur disponible pour servir ?" },
  { icon: FaChartBar, text: "Vous voulez impacter avec nous ?" },
];

const CandidatureCta = () => {
  const reveal = useReveal();
  const lift = useHoverLift();

  return (
    <section className="candidature-cta">
      <div className="candidature-cta__container">
        <ul className="candidature-cta__claims">
          {CLAIMS.map((claim, index) => (
            <motion.li
              key={claim.text}
              className="candidature-cta__claim"
              {...reveal(index, "x")}
            >
              <span className="candidature-cta__icon" aria-hidden="true">
                <claim.icon />
              </span>

              {claim.text}
            </motion.li>
          ))}
        </ul>

        {/* Ancre interne et non lien de route : le formulaire est sur
            cette même page, plus bas. */}
        <motion.a
          className="candidature-cta__button"
          href="#candidature-formulaire"
          {...reveal(3)}
          {...lift}
        >
          <span>
            Faites acte
            <strong>de candidature !</strong>
          </span>

          <span className="candidature-cta__button-icon" aria-hidden="true">
            <HiArrowRight />
          </span>
        </motion.a>
      </div>
    </section>
  );
};

export default CandidatureCta;
