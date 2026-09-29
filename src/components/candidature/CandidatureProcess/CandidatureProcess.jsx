import { motion } from "framer-motion";
import {
  FaFileAlt,
  FaBookOpen,
  FaClipboardCheck,
  FaUsers,
} from "react-icons/fa";

import { useReveal, useHoverLift } from "../motion";

import "./CandidatureProcess.scss";

const STEPS = [
  {
    icon: FaFileAlt,
    title: "Sélection",
    text: "Choisissez le poste qui correspond à votre profil.",
  },
  {
    icon: FaBookOpen,
    title: "Formation",
    text: "Les candidats seront accompagnés selon les besoins.",
  },
  {
    icon: FaClipboardCheck,
    title: "Évaluation",
    text: "Étude des candidatures et entretien si nécessaire.",
  },
  {
    icon: FaUsers,
    title: "Affectation",
    text: "Intégration dans l'équipe et début de la mission.",
  },
];

const CandidatureProcess = () => {
  const reveal = useReveal();
  const lift = useHoverLift();

  return (
    <section className="candidature-process">
      <div className="candidature-process__container">
        <motion.h2 className="candidature-process__title" {...reveal()}>
          Comment <span>ça marche ?</span>
        </motion.h2>

        {/* Une liste ORDONNÉE : les quatre étapes se suivent, l'ordre
            est l'information. L'échelonnement des apparitions
            (`reveal(index)`) donne à voir cette progression. */}
        <ol className="candidature-process__steps">
          {STEPS.map((step, index) => (
            <motion.li
              key={step.title}
              className="candidature-process__step"
              {...reveal(index)}
              {...lift}
            >
              <span className="candidature-process__icon" aria-hidden="true">
                <step.icon />
              </span>

              <h3 className="candidature-process__step-title">
                <span
                  className="candidature-process__number"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>

                {step.title}
              </h3>

              <p className="candidature-process__step-text">{step.text}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
};

export default CandidatureProcess;
