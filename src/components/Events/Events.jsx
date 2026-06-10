import {
  Calendar,
  ChevronRight,
  ArrowRight
} from "lucide-react";

import "./Events.scss";

const events = [
  {
    day: "25",
    month: "MAI",
    title: "Culte dominical",
    date: "Dimanche 25 Mai 2025 - 09:00",
    color: "green"
  },
  {
    day: "01",
    month: "JUIN",
    title: "Réunion de prière",
    date: "Dimanche 01 Juin 2025 - 18:00",
    color: "yellow"
  },
  {
    day: "07",
    month: "JUIN",
    title: "Soirée de louange",
    date: "Samedi 07 Juin 2025 - 17:00",
    color: "green"
  }
];

const Events = () => {
  return (
    <div className="events-card">

      <div className="events-header">
        <Calendar size={20} />
        <h3>PROCHAINS ÉVÉNEMENTS</h3>
      </div>

      {events.map((event, index) => (
        <div className="event" key={index}>

          <div className={`event-date ${event.color}`}>
            <span>{event.day}</span>
            <small>{event.month}</small>
          </div>

          <div className="event-content">
            <h4>{event.title}</h4>
            <p>{event.date}</p>
          </div>

          <ChevronRight size={20} />
        </div>
      ))}

      <a href="/" className="events-link">
        Voir tous les événements
        <ArrowRight size={18} />
      </a>

    </div>
  );
};

export default Events;