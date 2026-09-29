import { FaUsers, FaHeart, FaChartBar } from "react-icons/fa";
import { HiArrowRight } from "react-icons/hi";

import "./CandidatureCta.scss";

const CLAIMS = [
  { icon: FaUsers, text: "Vous avez des compétences ?" },
  { icon: FaHeart, text: "Vous avez un cœur disponible pour servir ?" },
  { icon: FaChartBar, text: "Vous voulez impacter avec nous ?" },
];

const CandidatureCta = () => (
  <section className="candidature-cta">
    <div className="candidature-cta__container">
      <ul className="candidature-cta__claims">
        {CLAIMS.map((claim) => (
          <li key={claim.text} className="candidature-cta__claim">
            <span className="candidature-cta__icon" aria-hidden="true">
              <claim.icon />
            </span>

            {claim.text}
          </li>
        ))}
      </ul>

      {/* Ancre interne et non lien de route : le formulaire est sur
          cette même page, plus bas. */}
      <a className="candidature-cta__button" href="#candidature-formulaire">
        <span>
          Faites acte
          <strong>de candidature !</strong>
        </span>

        <span className="candidature-cta__button-icon" aria-hidden="true">
          <HiArrowRight />
        </span>
      </a>
    </div>
  </section>
);

export default CandidatureCta;
