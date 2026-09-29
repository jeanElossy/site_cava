import {
  FaFileAlt,
  FaBookOpen,
  FaClipboardCheck,
  FaUsers,
} from "react-icons/fa";

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

const CandidatureProcess = () => (
  <section className="candidature-process">
    <div className="candidature-process__container">
      <h2 className="candidature-process__title">
        Comment <span>ça marche ?</span>
      </h2>

      {/* Une liste ORDONNÉE : les quatre étapes se suivent, l'ordre est
          l'information. Les chevrons de la maquette sont décoratifs et
          restent en CSS. */}
      <ol className="candidature-process__steps">
        {STEPS.map((step, index) => (
          <li key={step.title} className="candidature-process__step">
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
          </li>
        ))}
      </ol>
    </div>
  </section>
);

export default CandidatureProcess;
