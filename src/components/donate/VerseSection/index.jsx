import "./VerseSection.scss";

import {
  FaBible,
} from "react-icons/fa";

const VerseSection = () => {
  return (
    <section className="verse-section">

      <div className="verse-section__overlay" />

      <div className="verse-section__container">

        <div className="verse-card">

          <div className="verse-card__icon">
            <FaBible />
          </div>

          <span className="verse-card__badge">
            Parole de Dieu
          </span>

          <blockquote>
            « Que chacun donne comme il l'a
            résolu en son cœur, sans tristesse
            ni contrainte ; car Dieu aime
            celui qui donne avec joie. »
          </blockquote>

          <div className="verse-card__reference">
            2 Corinthiens 9:7
          </div>

        </div>

      </div>

    </section>
  );
};

export default VerseSection;