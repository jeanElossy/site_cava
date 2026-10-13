import { motion } from "framer-motion";

import "./EventSpeaker.scss";

/**
 * Initiales du nom, titres pastoraux retirés. Le site ne dispose pas de
 * portraits : on affiche un médaillon d'initiales plutôt qu'une image
 * cassée ou une photo d'illustration trompeuse.
 */
const getInitials = (name = "") =>
  name
    .replace(/^(Pasteur|Past\.|Fr\.|Sr\.)\s*/i, "")
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const EventSpeaker = ({ speaker }) => {
  // Tous les événements n'ont pas d'orateur identifié.
  if (!speaker) {
    return null;
  }

  return (
    <section
      className="event-speaker"
      aria-labelledby="event-speaker-title"
    >
      <div className="event-speaker__container">
        <header className="event-speaker__header">
          <span className="event-speaker__eyebrow">Intervenant</span>

          <h2 id="event-speaker-title">Orateur</h2>
        </header>

        <motion.article
          className="event-speaker__card"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.45 }}
        >
          {speaker.image ? (
            <img
              className="event-speaker__avatar"
              src={speaker.image}
              alt=""
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div
              className="event-speaker__avatar event-speaker__avatar--initials"
              aria-hidden="true"
            >
              {getInitials(speaker.name)}
            </div>
          )}

          <div className="event-speaker__body">
            <h3>{speaker.name}</h3>

            {speaker.role && (
              <span className="event-speaker__role">{speaker.role}</span>
            )}

            {speaker.bio && <p>{speaker.bio}</p>}
          </div>
        </motion.article>
      </div>
    </section>
  );
};

export default EventSpeaker;
