import { motion } from "framer-motion";

import {
  FaChurch,
  FaChild,
  FaPrayingHands,
  FaHeadset,
  FaHeart,
  FaArrowRight,
} from "react-icons/fa";

import "./ContactSchedule.scss";

// Horaires repris du contenu déjà publié sur le site
// (UpcomingEvents, Events et bloc « Nos coordonnées » de ContactForm).
const schedule = [
  {
    icon: <FaChurch />,
    title: "Culte dominical",
    day: "Dimanche",
    time: "09h00",
    detail: "Louange, enseignement et prière.",
  },
  {
    icon: <FaChild />,
    title: "École du dimanche",
    day: "Dimanche",
    time: "09h00",
    detail: "Enseignement biblique adapté aux enfants.",
  },
  {
    icon: <FaPrayingHands />,
    title: "Réunion de prière",
    day: "Mercredi",
    time: "18h30",
    detail: "Intercession pour nos familles et notre nation.",
  },
  {
    icon: <FaHeadset />,
    title: "Accueil & secrétariat",
    day: "Lundi - Dimanche",
    time: "08h00 - 17h00",
    detail: "Une équipe disponible pour vous orienter.",
  },
];

const ContactSchedule = () => {
  return (
    <section
      className="contact-schedule"
      aria-labelledby="contact-schedule-title"
    >
      <div className="contact-schedule__container">
        <header className="contact-schedule__header">
          <h2 id="contact-schedule-title">Horaires des cultes</h2>

          <div className="contact-schedule__line" />

          <p>
            Nos portes vous sont ouvertes. Venez tel que vous êtes, vous
            serez toujours le bienvenu parmi nous.
          </p>
        </header>

        <ul className="contact-schedule__grid">
          {schedule.map((item, index) => (
            <motion.li
              key={item.title}
              className="schedule-card"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: index * 0.07 }}
            >
              <div className="schedule-card__icon" aria-hidden="true">
                {item.icon}
              </div>

              <h3>{item.title}</h3>

              <p className="schedule-card__day">{item.day}</p>

              <p className="schedule-card__time">{item.time}</p>

              <p className="schedule-card__detail">{item.detail}</p>
            </motion.li>
          ))}
        </ul>

        <motion.aside
          className="contact-schedule__prayer"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
        >
          <div className="contact-schedule__prayer-icon" aria-hidden="true">
            <FaHeart />
          </div>

          <div className="contact-schedule__prayer-body">
            <h2>Prions pour vous</h2>

            <p>
              Vous traversez une épreuve, vous avez un sujet de
              reconnaissance ou vous souhaitez simplement être porté dans la
              prière ? Partagez-nous votre requête : notre équipe
              d'intercession priera pour vous en toute confidentialité.
            </p>

            <a
              className="contact-schedule__prayer-link"
              href="#contact-formulaire"
            >
              Envoyer une demande de prière
              <FaArrowRight aria-hidden="true" />
            </a>
          </div>
        </motion.aside>
      </div>
    </section>
  );
};

export default ContactSchedule;
