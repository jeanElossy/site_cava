import { FaBible } from "react-icons/fa";

import "./VerseSection.scss";

const VerseSection = () => {
  return (
    <section className="verse-section">
      <div className="verse-section__container">
        <div className="verse-section__card">

          <span className="verse-section__icon" aria-hidden="true">
            <FaBible />
          </span>

          <span className="verse-section__badge">Parole de Dieu</span>

          <blockquote>
            « Que chacun donne comme il l&apos;a résolu en son cœur,
            sans tristesse ni contrainte ; car Dieu aime celui qui donne
            avec joie. »
          </blockquote>

          <p className="verse-section__reference">2 Corinthiens 9:7</p>

        </div>
      </div>
    </section>
  );
};

export default VerseSection;
