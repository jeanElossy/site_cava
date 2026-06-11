import {
  Calendar,
  ChevronRight,
  ArrowRight,
} from "lucide-react";

import { Link } from "react-router-dom";

import "./Events.scss";

const events = [
  {
    day: "15",
    month: "JUIN",
    title: "Culte S'OFFRIR À DIEU",
    date: "Dimanche 15 Juin 2025 - 08:30",
    description:
      "Temps d'adoration, de prière et d'enseignement.",
    color: "green",
  },
  {
    day: "17",
    month: "JUIN",
    title: "ÉCOLE DE LA FOI",
    date: "Mercredi 17 Juin 2025 - 18:30",
    description:
      "Formation biblique et croissance spirituelle.",
    color: "yellow",
  },
  {
    day: "27",
    month: "JUIN",
    title: "Camp de Formation Spirituelle",
    date: "27 au 28 Juin 2025 • 09h00 - 17h00",
    description:
      "Thème : Persévérer dans la discipline spirituelle • Orateur : Pasteur Israël Liaide",
    color: "yellow",
  },
];

const Events = () => {
  return (
    <div className="events-card">

      <div className="events-header">
        <Calendar size={20} />
        <h3>PROCHAINS ÉVÉNEMENTS</h3>
      </div>

      <div className="events-list">
        {events.map((event, index) => (
          <div
            className="event"
            key={index}
          >
            <div
              className={`event-date ${event.color}`}
            >
              <span>{event.day}</span>
              <small>{event.month}</small>
            </div>

            <div className="event-content">
              <h4>{event.title}</h4>

              <p>{event.date}</p>

              <span className="event-description">
                {event.description}
              </span>
            </div>

            <ChevronRight size={20} />
          </div>
        ))}
      </div>

      <Link
        to="/events"
        className="events-link"
      >
        Voir tous les événements
        <ArrowRight size={18} />
      </Link>

    </div>
  );
};

export default Events;