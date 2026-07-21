import { FaArrowRight } from "react-icons/fa";

import { useContribution } from "../../../context/ContributionContext";

import "./ProjectsProgress.scss";

// Projets soutenus par les contributions.
//
// ------------------------------------------------------------------
// POURQUOI IL N'Y A PLUS DE JAUGE DE COLLECTE
// ------------------------------------------------------------------
// Chaque carte portait une barre de progression et deux montants
// précis : « 18 500 000 / 25 000 000 FCFA — 74 % atteint ». Ces
// valeurs étaient écrites en dur dans le composant, sans aucune source
// derrière, et n'avaient jamais bougé.
//
// Un thermomètre de collecte n'est pas un ornement : c'est l'argument
// de vente d'une page de don. Quelqu'un qui donne parce qu'un projet
// est « à 74 % » décide sur la foi d'un chiffre inventé — et l'église
// se retrouverait bien en peine de justifier ces montants si on les
// lui demandait.
//
// Les jauges reviendront le jour où objectifs et montants collectés
// seront saisis dans l'administration et calculés à partir des dons
// réels. En attendant, la carte fait ce qu'elle sait faire
// honnêtement : présenter le projet et proposer de le soutenir.
//
// `project` correspond aux identifiants d'affectation du formulaire
// (voir ContributionForm/data.js) : cliquer préremplit le tunnel.
const projects = [
  {
    id: "temple",
    project: "construction",
    title: "Construction du nouveau temple",
    image: "/images/project-church.jpg",
    description:
      "Un lieu de culte plus vaste, pour accueillir une assemblée qui ne cesse de grandir.",
  },
  {
    id: "media",
    project: "media",
    title: "Équipement média & streaming",
    image: "/images/project-media.jpg",
    description:
      "Caméras, son et diffusion en direct, pour porter la Parole au-delà des murs de l'église.",
  },
  {
    id: "social",
    project: "social",
    title: "Action sociale",
    image: "/images/project-social.jpg",
    description:
      "Aide aux familles en difficulté, soutien scolaire et accompagnement des plus fragiles.",
  },
];

const ProjectsProgress = () => {
  const { dispatch } = useContribution();

  // Prérempli le tunnel puis y ramène le visiteur.
  //
  // Le formulaire est sur la même page : une navigation ferait perdre
  // le contexte, un simple ancrage n'aurait rien sélectionné.
  const support = (project) => {
    dispatch({ type: "SET_TYPE", payload: "projet" });
    dispatch({ type: "SET_PROJECT", payload: project });

    document
      .getElementById("contribution-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="projects-progress">
      <div className="projects-progress__container">

        <header className="projects-progress__header">
          <span className="donate-eyebrow">Nos chantiers</span>

          <h2>Projets en cours</h2>

          <p>
            Voici ce que les contributions de l'église rendent possible
            aujourd'hui. Vous pouvez affecter votre don à l'un d'eux.
          </p>
        </header>

        <div className="projects-progress__grid">
          {projects.map((project) => (
            <article
              key={project.id}
              className="projects-progress__card"
            >
              <div className="projects-progress__image">
                <img
                  src={project.image}
                  alt={project.title}
                  loading="lazy"
                />
              </div>

              <div className="projects-progress__content">
                <h3>{project.title}</h3>

                <p>{project.description}</p>

                <button
                  type="button"
                  className="projects-progress__button"
                  onClick={() => support(project.project)}
                >
                  Soutenir ce projet
                  <FaArrowRight aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>

      </div>
    </section>
  );
};

export default ProjectsProgress;
