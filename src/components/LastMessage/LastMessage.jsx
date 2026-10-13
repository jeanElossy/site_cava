import { useState } from "react";

import { Link } from "react-router-dom";

import { motion } from "framer-motion";

import { Play, ArrowRight, CalendarDays, Clock } from "lucide-react";

import { messages, isPlayable } from "../Media/data/medias";

import MediaPlayerModal from "../MediaPlayerModal/MediaPlayerModal";

import fallbackImg from "../../assets/images/message.jpg";

import "./LastMessage.scss";

// Section « Dernier message » de l'accueil.
//
// Les messages arrivent déjà triés du plus récent au plus ancien
// (`publicSort: { publishedAt: -1 }` côté API) : le premier fait foi.
// Sans message publié, la section reste, mais sans annoncer un contenu
// inexistant.
const LastMessage = () => {
  const [playing, setPlaying] = useState(null);

  const latest = messages[0];

  const playable = latest ? isPlayable(latest) : false;

  // Un lecteur existe sur le site (MediaPlayerModal) : la lecture se fait
  // sur place. Sans vidéo rattachée, le bouton renvoie vers la page
  // Médias plutôt que de simuler une lecture.
  const playLabel = latest
    ? playable
      ? `Regarder : ${latest.title}`
      : `Voir « ${latest.title} » sur la page Médias`
    : "Voir la page Médias";

  const renderPlay = (className, children) =>
    playable ? (
      <button
        type="button"
        className={className}
        onClick={() => setPlaying(latest)}
        aria-label={playLabel}
      >
        {children}
      </button>
    ) : (
      <Link
        to="/media"
        className={className}
        aria-label={playLabel}
      >
        {children}
      </Link>
    );

  return (
    <section
      className="home-message"
      aria-labelledby="home-message-title"
    >
      <div className="home-message__container">
        <motion.div
          className="home-message__media"
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <img
            src={latest?.image || fallbackImg}
            alt=""
            loading="lazy"
            decoding="async"
          />

          {renderPlay(
            "home-message__play",
            <Play
              fill="currentColor"
              size={30}
              aria-hidden="true"
            />
          )}
        </motion.div>

        <div className="home-message__body">
          <span className="home-message__eyebrow">
            {latest ? "Dernier message" : "Enseignements"}
          </span>

          <h2 id="home-message-title">
            {latest ? latest.title : "Nos enseignements"}
          </h2>

          {latest ? (
            <>
              {latest.author && (
                <p className="home-message__author">
                  Par {latest.author}
                </p>
              )}

              <ul className="home-message__meta">
                {latest.date && (
                  <li>
                    <CalendarDays size={16} aria-hidden="true" />
                    {latest.date}
                  </li>
                )}

                {latest.duration && (
                  <li>
                    <Clock size={16} aria-hidden="true" />
                    {latest.duration}
                  </li>
                )}
              </ul>
            </>
          ) : (
            <p className="home-message__author">
              Les messages du Centre Apostolique Vie et Abondance seront
              publiés ici.
            </p>
          )}

          <p className="home-message__text">
            Prédications, louanges et témoignages : retrouvez les
            enseignements de l&apos;église et revivez les cultes où que
            vous soyez.
          </p>

          <div className="home-message__actions">
            {latest &&
              renderPlay(
                "home-message__cta",
                <>
                  {playable ? "Regarder le message" : "Voir le message"}
                  <Play
                    fill="currentColor"
                    size={14}
                    aria-hidden="true"
                  />
                </>
              )}

            <Link
              to="/media"
              className="home-message__cta home-message__cta--ghost"
            >
              Tous les médias
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      <MediaPlayerModal
        item={playing}
        onClose={() => setPlaying(null)}
      />
    </section>
  );
};

export default LastMessage;
