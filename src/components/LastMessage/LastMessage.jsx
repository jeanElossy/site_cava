import { useState } from "react";

import { Link } from "react-router-dom";

import { Play, ArrowRight } from "lucide-react";

import { messages, isPlayable } from "../Media/data/medias";

import MediaPlayerModal from "../MediaPlayerModal/MediaPlayerModal";

import fallbackImg from "../../assets/images/message.jpg";

import "./LastMessage.scss";

// Encart « Dernier message » de la page d'accueil.
//
// Le contenu était auparavant écrit en dur : une image fixe, la date
// « Dimanche 25 Mai 2026 » et un titre invariable. Publier un nouveau
// message depuis l'administration ne changeait donc rien ici, et
// l'accueil finissait par annoncer un message qui n'était plus le
// dernier.
//
// Les messages arrivent déjà triés du plus récent au plus ancien
// (`publicSort: { publishedAt: -1 }` côté API) : le premier fait foi.
const LastMessage = () => {
  const [playing, setPlaying] = useState(null);

  const latest = messages[0];

  // Aucun message publié : on garde l'encart, mais sans annoncer un
  // contenu inexistant.
  if (!latest) {
    return (
      <div className="message-card">
        <div className="message-image">
          <img
            src={fallbackImg}
            alt=""
            aria-hidden="true"
          />

          <div className="overlay"></div>

          <span className="badge">Messages</span>
        </div>

        <div className="message-content">
          <h3>Nos enseignements</h3>

          <p>
            Les messages du Centre Apostolique Vie et Abondance seront
            publiés ici.
          </p>

          <Link to="/media">
            Voir la page Médias
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  const playable = isPlayable(latest);

  return (
    <div className="message-card">
      <div className="message-image">
        <img
          src={latest.image || fallbackImg}
          alt=""
          aria-hidden="true"
        />

        <div className="overlay"></div>

        {/* Un lecteur existe désormais sur le site (MediaPlayerModal),
            et la CSP autorise youtube-nocookie : la lecture se fait
            donc sur place. Sans vidéo rattachée, le bouton renvoie
            vers la page Médias plutôt que de simuler une lecture. */}
        {playable ? (
          <button
            type="button"
            className="play-btn"
            onClick={() => setPlaying(latest)}
            aria-label={`Regarder : ${latest.title}`}
          >
            <Play
              fill="currentColor"
              size={28}
              aria-hidden="true"
            />
          </button>
        ) : (
          <Link
            to="/media"
            className="play-btn"
            aria-label={`Voir « ${latest.title} » sur la page Médias`}
          >
            <Play
              fill="currentColor"
              size={28}
              aria-hidden="true"
            />
          </Link>
        )}

        <span className="badge">Dernier message</span>
      </div>

      <div className="message-content">
        <small>
          {latest.date}
          {latest.duration ? ` · ${latest.duration}` : ""}
        </small>

        <h3>{latest.title}</h3>

        <p>
          {latest.author
            ? `Par ${latest.author}.`
            : "Dernier enseignement du Centre Apostolique Vie et Abondance."}
        </p>

        <Link to="/media">
          Voir tous les messages
          <ArrowRight size={16} />
        </Link>
      </div>

      <MediaPlayerModal
        item={playing}
        onClose={() => setPlaying(null)}
      />
    </div>
  );
};

export default LastMessage;
