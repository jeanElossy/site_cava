import { Link } from "react-router-dom";

import {
  Play,
  ArrowRight
} from "lucide-react";

import messageImg from "../../assets/images/message.jpg";

import "./LastMessage.scss";

const LastMessage = () => {
  return (
    <div className="message-card">

      <div className="message-image">

        <img
          src={messageImg}
          alt="Dernier message"
        />

        <div className="overlay"></div>

        {/*
          Il n'existe pas de lecteur vidéo sur le site et la CSP interdit
          tout iframe externe : ce bouton renvoie vers la page Médias
          plutôt que de simuler une lecture.
        */}
        <Link
          to="/media"
          className="play-btn"
          aria-label="Regarder le dernier message sur la page Médias"
        >
          <Play fill="currentColor" size={28} aria-hidden="true" />
        </Link>

        <span className="badge">
          Dernier message
        </span>

      </div>

      <div className="message-content">

        <small>Dimanche 25 Mai 2026</small>

        <h3>
          Marcher par la foi
          et non par la vue
        </h3>

        <p>
          Découvrez le dernier enseignement
          du Centre Apostolique Vie et Abondance.
        </p>

        <Link to="/media">
          Voir tous les messages
          <ArrowRight size={16} />
        </Link>

      </div>

    </div>
  );
};

export default LastMessage;