import "./MinistryContacts.scss";

import {
  FaUsers,
  FaHandsHelping,
  FaBookOpen,
  FaHome,
  FaHeart,
  FaGlobeAfrica,
  FaArrowRight,
} from "react-icons/fa";

const ministries = [
  {
    icon: <FaUsers />,
    title: "Enfance & Jeunesse",
    description:
      "Pour toutes questions concernant les enfants et les jeunes.",
    email: "enfance@cava.ci",
    color: "green",
  },
  {
    icon: <FaHeart />,
    title: "Louange & Adoration",
    description:
      "Pour rejoindre l'équipe ou toute information sur les temps d'adoration.",
    email: "louange@cava.ci",
    color: "gold",
  },
  {
    icon: <FaBookOpen />,
    title: "Enseignement",
    description:
      "Pour toute information sur nos formations et études bibliques.",
    email: "enseignement@cava.ci",
    color: "green",
  },
  {
    icon: <FaHome />,
    title: "Groupes de maison",
    description:
      "Pour trouver ou créer un groupe de maison près de chez vous.",
    email: "maisons@cava.ci",
    color: "gold",
  },
  {
    icon: <FaHandsHelping />,
    title: "Action Sociale",
    description:
      "Pour nos actions humanitaires et projets communautaires.",
    email: "social@cava.ci",
    color: "green",
  },
  {
    icon: <FaGlobeAfrica />,
    title: "Évangélisation",
    description:
      "Pour participer ou organiser des actions d'évangélisation.",
    email: "evangelisation@cava.ci",
    color: "gold",
  },
];

const MinistryContacts = () => {
  return (
    <section className="ministry-contacts">
      <div className="ministry-contacts__container">
        <div className="ministry-contacts__header">
          <h2>Contactez un ministère</h2>

          <p>
            Besoin d'informations spécifiques ? Contactez directement le
            ministère concerné.
          </p>
        </div>

        <div className="ministry-contacts__grid">
          {ministries.map((ministry, index) => (
            <div
              className="ministry-card"
              key={index}
            >
              <div
                className={`ministry-card__icon ministry-card__icon--${ministry.color}`}
              >
                {ministry.icon}
              </div>

              <h3>{ministry.title}</h3>

              <p>{ministry.description}</p>

              <a href={`mailto:${ministry.email}`}>
                {ministry.email}
                <FaArrowRight />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default MinistryContacts;