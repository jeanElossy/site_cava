import { motion } from "framer-motion";

import "./EventDescription.scss";

const EventDescription = ({ event }) => {
  const paragraphs = event.content || [];

  if (paragraphs.length === 0) {
    return null;
  }

  return (
    <section
      className="event-description"
      aria-labelledby="event-description-title"
    >
      <div className="event-description__container">
        <motion.div
          className="event-description__body"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.45 }}
        >
          <h2 id="event-description-title">À propos de cet événement</h2>

          <div className="event-description__line" />

          {event.theme && (
            <p className="event-description__theme">
              <strong>Thème :</strong> {event.theme}
            </p>
          )}

          {paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default EventDescription;
