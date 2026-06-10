import {
  Play,
  ArrowRight
} from "lucide-react";

import messageImg from "../../assets/images/message.jpg.png";

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

        <button className="play-btn">
          <Play fill="currentColor" size={28} />
        </button>

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

        <a href="/">
          Voir tous les messages
          <ArrowRight size={16} />
        </a>

      </div>

    </div>
  );
};

export default LastMessage;