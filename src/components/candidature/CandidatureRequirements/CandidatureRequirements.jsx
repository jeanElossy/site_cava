import { motion } from "framer-motion";
import { FaUserCheck, FaClipboardList, FaCheckCircle } from "react-icons/fa";

import { useReveal } from "../motion";

import "./CandidatureRequirements.scss";

const CONDITIONS = [
  "Être membre actif de la communauté ÇA.VA.",
  "Avoir un cœur de serviteur.",
  "Disposer des compétences et du temps nécessaires.",
  "Adhérer à la vision et aux valeurs de l'église.",
  "Remplir correctement le formulaire de candidature.",
];

const DOCUMENTS = [
  "Formulaire de candidature en ligne",
  "Curriculum vitae (CV)",
  "Lettre de motivation",
  "Renseignements complémentaires selon le poste",
];

const CandidatureRequirements = () => {
  const reveal = useReveal();

  return (
    <section className="candidature-requirements">
      <div className="candidature-requirements__container">
        <motion.article
          className="candidature-requirements__panel candidature-requirements__panel--green"
          {...reveal(0, "x")}
        >
          <header className="candidature-requirements__header">
            <span
              className="candidature-requirements__icon"
              aria-hidden="true"
            >
              <FaUserCheck />
            </span>

            <h2>Conditions générales</h2>
          </header>

          <ul className="candidature-requirements__list">
            {CONDITIONS.map((item, index) => (
              <motion.li key={item} {...reveal(index + 1)}>
                <FaCheckCircle aria-hidden="true" />
                {item}
              </motion.li>
            ))}
          </ul>
        </motion.article>

        <motion.article
          className="candidature-requirements__panel candidature-requirements__panel--gold"
          {...reveal(1)}
        >
          <header className="candidature-requirements__header">
            <span
              className="candidature-requirements__icon"
              aria-hidden="true"
            >
              <FaClipboardList />
            </span>

            <h2>Documents requis</h2>
          </header>

          <ul className="candidature-requirements__list">
            {DOCUMENTS.map((item, index) => (
              <motion.li key={item} {...reveal(index + 1)}>
                <FaCheckCircle aria-hidden="true" />
                {item}
              </motion.li>
            ))}
          </ul>

          {/* Le formulaire ci-dessous ne reçoit PAS de pièce jointe : le
              CV et la lettre se remettent au secrétariat. Le dire ici
              évite qu'un candidat cherche un bouton inexistant. */}
          <p className="candidature-requirements__note">
            Le CV et la lettre de motivation sont à remettre au secrétariat
            exécutif après l&apos;envoi du formulaire.
          </p>
        </motion.article>
      </div>
    </section>
  );
};

export default CandidatureRequirements;
