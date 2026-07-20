import { motion } from "framer-motion";

import {
  FaRegCalendarAlt,
  FaRegClock,
  FaMapMarkerAlt,
  FaUsers,
} from "react-icons/fa";

import "./EventInfo.scss";

const EventInfo = ({ event }) => {
  // Les informations pratiques sont dérivées des champs réellement
  // renseignés : une carte absente n'est pas affichée.
  const items = [
    {
      icon: <FaRegCalendarAlt />,
      label: "Date",
      value: event.date,
    },
    {
      icon: <FaRegClock />,
      label: "Horaire",
      value: event.endTime
        ? `${event.time} - ${event.endTime}`
        : event.time,
    },
    {
      icon: <FaMapMarkerAlt />,
      label: "Lieu",
      value: event.location,
      detail: event.address,
    },
    {
      icon: <FaUsers />,
      label: "Public",
      value: event.audience,
    },
  ].filter((item) => item.value);

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="event-info" aria-labelledby="event-info-title">
      <div className="event-info__container">
        <header className="event-info__header">
          <h2 id="event-info-title">Informations pratiques</h2>

          <div className="event-info__line" />
        </header>

        <ul className="event-info__grid">
          {items.map((item, index) => (
            <motion.li
              key={item.label}
              className="info-card"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: index * 0.07 }}
            >
              <div className="info-card__icon" aria-hidden="true">
                {item.icon}
              </div>

              <h3>{item.label}</h3>

              <p className="info-card__value">{item.value}</p>

              {item.detail && (
                <p className="info-card__detail">{item.detail}</p>
              )}
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default EventInfo;
