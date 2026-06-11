import "./ProjectsProgress.scss";

const projects = [
  {
    id: 1,
    title: "Construction du nouveau temple",
    image: "/images/project-church.jpg",
    current: 18500000,
    target: 25000000,
  },
  {
    id: 2,
    title: "Équipement Média & Streaming",
    image: "/images/project-media.jpg",
    current: 200000,
    target: 2500000,
  },
  {
    id: 3,
    title: "Action Sociale",
    image: "/images/project-social.jpg",
    current: 4200000,
    target: 7000000,
  },
];

const ProjectsProgress = () => {
  return (
    <section className="projects-progress">

      <div className="section-header">

        <h2>Projets en cours</h2>

        <p>
          Découvrez les projets actuellement soutenus
          par les contributions de l'église.
        </p>

      </div>

      <div className="projects-grid">

        {projects.length === 0 ? (

          <div className="empty-projects">

            <h3>Aucun projet actif</h3>

            <p>
              Aucun projet n'est actuellement
              en cours de financement.
            </p>

          </div>

        ) : (

          projects.map((project) => {

            const percent = Math.min(
              100,
              Math.round(
                (project.current / project.target) * 100
              )
            );

            return (
              <article
                key={project.id}
                className="project-card"
              >

                <div className="project-image">

                  <img
                    src={project.image}
                    alt={project.title}
                  />

                  <span className="project-badge">
                    En cours
                  </span>

                </div>

                <div className="project-content">

                  <h3>{project.title}</h3>

                  <div className="progress-info">

                    <span>
                      {project.current.toLocaleString()} FCFA
                    </span>

                    <span>
                      {project.target.toLocaleString()} FCFA
                    </span>

                  </div>

                  <div className="progress-bar">

                    <div
                      className="progress-fill"
                      style={{
                        width: `${percent}%`,
                      }}
                    />

                  </div>

                  <strong>
                    {percent}% atteint
                  </strong>

                </div>

              </article>
            );
          })

        )}

      </div>

    </section>
  );
};

export default ProjectsProgress;