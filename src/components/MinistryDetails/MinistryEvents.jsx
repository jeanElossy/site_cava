import { motion } from "framer-motion";

import { FaRegClock, FaMapMarkerAlt } from "react-icons/fa";

import "./MinistryEvents.scss";

const MinistryEvents = ({ events = [] }) => {
  if (events.length === 0) {
    return null;
  }

  return (
    <section
      className="ministry-events"
      aria-labelledby="ministry-events-title"
    >
      <div className="ministry-events__container">
        <header className="ministry-events__header">
          <span className="ministry-events__eyebrow">Agenda</span>

          <h2 id="ministry-events-title">Prochains événements</h2>
        </header>

        <ul className="ministry-events__grid">
          {events.map((event, index) => (
            <motion.li
              key={`${event.title}-${event.day}`}
              className="ministry-events__card"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
            >
              <div className="ministry-events__date" aria-hidden="true">
                <span className="ministry-events__day">{event.day}</span>

                <span className="ministry-events__month">{event.month}</span>
              </div>

              <div className="ministry-events__body">
                <h3>{event.title}</h3>

                <p className="ministry-events__meta">
                  <span>
                    <FaRegClock aria-hidden="true" />

                    <span className="sr-only">Horaire :</span>

                    {event.time}
                  </span>

                  <span>
                    <FaMapMarkerAlt aria-hidden="true" />

                    <span className="sr-only">Lieu :</span>

                    {event.location}
                  </span>
                </p>

                {event.description && (
                  <p className="ministry-events__description">
                    {event.description}
                  </p>
                )}
              </div>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default MinistryEvents;
