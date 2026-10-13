import { FaBullseye, FaEye } from "react-icons/fa";

import "./MinistryMission.scss";

const MinistryMission = ({ ministry }) => {
  const blocks = [
    {
      id: "mission",
      icon: FaBullseye,
      title: ministry?.mission?.title || "Notre mission",
      text: ministry?.mission?.description || "Mission en cours de définition.",
    },
    {
      id: "vision",
      icon: FaEye,
      title: ministry?.vision?.title || "Notre vision",
      text: ministry?.vision?.description || "Vision en cours de définition.",
    },
  ];

  return (
    <section
      className="ministry-mission"
      aria-label="Mission et vision du ministère"
    >
      <div className="ministry-mission__container">
        {blocks.map((block) => {
          const Icon = block.icon;

          return (
            <article
              key={block.id}
              className={`ministry-mission__card ministry-mission__card--${block.id}`}
            >
              <span
                className="ministry-mission__icon"
                aria-hidden="true"
              >
                <Icon />
              </span>

              <h2>{block.title}</h2>

              <p>{block.text}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default MinistryMission;
