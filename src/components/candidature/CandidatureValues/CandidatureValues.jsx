import { motion } from "framer-motion";
import {
  FaHandHoldingHeart,
  FaBookOpen,
  FaSeedling,
  FaUsers,
} from "react-icons/fa";

import { useReveal } from "../motion";

import "./CandidatureValues.scss";

const VALUES = [
  { icon: FaHandHoldingHeart, label: "Servir" },
  { icon: FaBookOpen, label: "Se former" },
  { icon: FaSeedling, label: "Grandir" },
  { icon: FaUsers, label: "Impacter" },
];

const CandidatureValues = () => {
  const reveal = useReveal();

  return (
    <section className="candidature-values">
      <div className="candidature-values__container">
        <ul className="candidature-values__list">
          {VALUES.map((value, index) => (
            <motion.li
              key={value.label}
              className="candidature-values__item"
              {...reveal(index)}
            >
              <span className="candidature-values__icon" aria-hidden="true">
                <value.icon />
              </span>

              {value.label}
            </motion.li>
          ))}
        </ul>

        <motion.blockquote
          className="candidature-values__verse"
          {...reveal(4)}
        >
          <p>
            « Chacun, selon le don qu&apos;il a reçu, le mette au service
            des autres. »
          </p>

          <cite>1 Pierre 4:10</cite>
        </motion.blockquote>
      </div>
    </section>
  );
};

export default CandidatureValues;
