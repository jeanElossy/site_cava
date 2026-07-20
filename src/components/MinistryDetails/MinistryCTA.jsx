import { Link } from "react-router-dom";

import { FaUsers } from "react-icons/fa";

import "./MinistryCTA.scss";

const MinistryCTA = ({ ministry }) => {
  return (
    <section className="ministry-cta">
      <div className="overlay" aria-hidden="true" />

      <div className="container">
        <h2>Rejoignez le ministère {ministry.title}</h2>

        <p>
          Découvrez votre appel et servez avec nous pour impacter des vies et
          faire avancer le Royaume de Dieu.
        </p>

        <Link to="/contact" className="ministry-cta__button">
          Rejoindre maintenant
          <FaUsers aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
};

export default MinistryCTA;
