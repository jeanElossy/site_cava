import {
  FaHandHoldingHeart,
  FaBookOpen,
  FaSeedling,
  FaUsers,
} from "react-icons/fa";

import "./CandidatureValues.scss";

const VALUES = [
  { icon: FaHandHoldingHeart, label: "Servir" },
  { icon: FaBookOpen, label: "Se former" },
  { icon: FaSeedling, label: "Grandir" },
  { icon: FaUsers, label: "Impacter" },
];

const CandidatureValues = () => (
  <section className="candidature-values">
    <div className="candidature-values__container">
      <ul className="candidature-values__list">
        {VALUES.map((value) => (
          <li key={value.label} className="candidature-values__item">
            <span className="candidature-values__icon" aria-hidden="true">
              <value.icon />
            </span>

            {value.label}
          </li>
        ))}
      </ul>

      <blockquote className="candidature-values__verse">
        <p>
          « Chacun, selon le don qu&apos;il a reçu, le mette au service des
          autres. »
        </p>

        <cite>1 Pierre 4:10</cite>
      </blockquote>
    </div>
  </section>
);

export default CandidatureValues;
