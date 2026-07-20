import usePageMeta from "../../hooks/usePageMeta";

import "./NotFound.scss";

import { Link } from "react-router-dom";

import {
  FaHome,
  FaHeart,
  FaCalendarAlt,
  FaBookOpen,
  FaEnvelope,
} from "react-icons/fa";

const NotFound = () => {
  usePageMeta({
    title: "Page introuvable",
    description:
      "La page que vous recherchez n'existe pas ou a été déplacée.",
  });

  return (
    <main className="not-found">

      <div className="particles">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className="not-found__background">
        404
      </div>

      <div className="not-found__content">

        <span className="not-found__badge">
          Oups...
        </span>

        <h1>
          Cette page est introuvable
        </h1>

        <p>
          La page que vous recherchez a peut-être
          été déplacée, supprimée ou n'existe plus.
        </p>

        <div className="not-found__actions">

          <Link
            to="/"
            className="btn-primary"
          >
            <FaHome />
            Retour à l'accueil
          </Link>

          <Link
            to="/donate"
            className="btn-secondary"
          >
            <FaHeart />
            Faire un don
          </Link>

        </div>

        <div className="not-found__verse">

          <span>
            Jérémie 29:11
          </span>

          <blockquote>
            « Car je connais les projets que
            j'ai formés sur vous, dit l'Éternel,
            projets de paix et non de malheur,
            afin de vous donner un avenir et
            de l'espérance. »
          </blockquote>

        </div>

        <div className="quick-links">

          <Link to="/events">

            <FaCalendarAlt />

            <h4>Événements</h4>

            <p>
              Découvrez nos prochains rendez-vous.
            </p>

          </Link>

          <Link to="/media">

            <FaBookOpen />

            <h4>Sermons</h4>

            <p>
              Écoutez nos derniers messages.
            </p>

          </Link>

          <Link to="/contact">

            <FaEnvelope />

            <h4>Contact</h4>

            <p>
              Notre équipe est à votre écoute.
            </p>

          </Link>

        </div>

      </div>

    </main>
  );
};

export default NotFound;