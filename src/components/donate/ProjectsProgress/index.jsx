import { Link } from "react-router-dom";

import { FaArrowRight } from "react-icons/fa";

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
// ------------------------------------------------------------------
// L'AFFECTATION PASSE PAR LE TYPE DE DON, PLUS PAR UN « PROJET »
// ------------------------------------------------------------------
// Chaque carte préremplissait un champ `project` de l'état du tunnel.
// Ce champ n'existe plus : les types de don administrables
// (« Construction », « Mission »…) jouent ce rôle, et c'est la seule
// affectation que le serveur enregistre sur un don.
//
// `donationType` porte donc le NOM d'un type de don tel qu'il est
// saisi dans l'administration — c'est lui qui part dans
// `/donate?type=<nom>`, exactement comme le QR code projeté pendant un
// culte. Un projet sans type correspondant se contente d'amener au
// formulaire : mieux vaut aucun préremplissage qu'un `?type=` qui ne
// désigne rien.
const projects = [
  {
    id: "temple",
    donationType: "Construction",
    title: "Construction du nouveau temple",
    image: "/images/project-church.jpg",
    description:
      "Un lieu de culte plus vaste, pour accueillir une assemblée qui ne cesse de grandir.",
  },
  {
    id: "media",
    title: "Équipement média & streaming",
    image: "/images/project-media.jpg",
    description:
      "Caméras, son et diffusion en direct, pour porter la Parole au-delà des murs de l'église.",
  },
  {
    id: "social",
    title: "Action sociale",
    image: "/images/project-social.jpg",
    description:
      "Aide aux familles en difficulté, soutien scolaire et accompagnement des plus fragiles.",
  },
];

const donateLink = (donationType) =>
  donationType
    ? `/donate?type=${encodeURIComponent(donationType)}#contribution-form`
    : "/donate#contribution-form";

const ProjectsProgress = () => {
  // Le tunnel est sur la même page : le lien met le `?type=` dans
  // l'URL (lu par `StepIdentity`), le défilement amène le visiteur au
  // formulaire. React Router ne défile pas de lui-même sur un `#`.
  const scrollToForm = () => {
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
            Voici ce que les contributions de l&apos;église rendent
            possible aujourd&apos;hui. Vous pouvez soutenir l&apos;un
            d&apos;eux en choisissant le type de don correspondant.
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

                <Link
                  className="projects-progress__button"
                  to={donateLink(project.donationType)}
                  onClick={scrollToForm}
                >
                  Soutenir ce projet
                  <FaArrowRight aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>

      </div>
    </section>
  );
};

export default ProjectsProgress;
