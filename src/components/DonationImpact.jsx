import "./DonationImpact.scss";

import {
  FaUsers,
  FaBookOpen,
  FaHandsHelping,
  FaChurch,
} from "react-icons/fa";

const impacts = [
  {
    icon: <FaUsers />,
    color: "green",
    title: "Soutenir l'évangélisation",
    description:
      "Aidez-nous à annoncer l'Évangile et gagner des âmes pour le Royaume de Dieu.",
  },
  {
    icon: <FaBookOpen />,
    color: "gold",
    title: "Former des disciples",
    description:
      "Contribuez à l'enseignement biblique et à la formation de leaders pour demain.",
  },
  {
    icon: <FaHandsHelping />,
    color: "green",
    title: "Aider les plus démunis",
    description:
      "Participez à nos actions sociales pour apporter amour, soutien et espoir aux nécessiteux.",
  },
  {
    icon: <FaChurch />,
    color: "gold",
    title: "Soutenir nos projets",
    description:
      "Permettez le développement de nos infrastructures et de nos ministères.",
  },
];

const DonationImpact = () => {
  return (
    <section className="donation-impact">
      <div className="donation-impact__container">

        <h2>Votre don, un impact éternel</h2>

        <div className="donation-impact__grid">

          {impacts.map((item, index) => (
            <article
              key={index}
              className="impact-card"
            >
              <div
                className={`impact-card__icon impact-card__icon--${item.color}`}
              >
                {item.icon}
              </div>

              <h3>{item.title}</h3>

              <p>{item.description}</p>
            </article>
          ))}

        </div>
      </div>
    </section>
  );
};

export default DonationImpact;