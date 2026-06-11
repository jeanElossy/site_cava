import "./UpcomingEvents.scss";

import {
  FaCalendarAlt,
  FaClock,
  FaMapMarkerAlt,
  FaArrowRight,
  FaHeart,
} from "react-icons/fa";

import event1 from "../assets/images/event-1.jpg";
import event2 from "../assets/images/event-2.jpg";
import event3 from "../assets/images/event-3.jpg";
import event4 from "../assets/images/event-4.jpg";
import event5 from "../assets/images/event-5.jpg";

import phoneNewsletter from "../assets/images/phone-newsletter.png";

import CalendarWidget from "./CalendarWidget";

const events = [
  {
    day: "25",
    month: "MAI",
    image: event1,
    title: "Culte dominical",
    description:
      "Rejoignez-nous pour un temps de louange, d'enseignement et de prière.",
    time: "09h00",
    location: "CAVA, Abidjan",
  },
  {
    day: "01",
    month: "JUIN",
    image: event2,
    title: "Réunion de prière",
    description:
      "Un moment spécial de prière d’intercession pour nos familles et notre nation.",
    time: "18h00",
    location: "CAVA, Abidjan",
  },
  {
    day: "07",
    month: "JUIN",
    image: event3,
    title: "Soirée de louange",
    description:
      "Une soirée de louange et d’adoration pour élever le nom de Jésus.",
    time: "17h00",
    location: "CAVA, Abidjan",
  },
  {
    day: "15",
    month: "JUIN",
    image: event4,
    title: "École du dimanche - Spéciale",
    description:
      "Un enseignement biblique adapté à tous les âges pour grandir dans la parole de Dieu.",
    time: "09h00",
    location: "CAVA, Abidjan",
  },
  {
    day: "22",
    month: "JUIN",
    image: event5,
    title: "Conférence des leaders",
    description:
      "Former, équiper et inspirer les leaders pour un impact durable.",
    time: "09h00",
    location: "CAVA, Abidjan",
  },
];

const UpcomingEvents = () => {
  return (
    <section className="upcoming-events">
      <div className="upcoming-events__container">

        <div className="upcoming-events__left">

          <div className="section-title">
            <div className="section-icon">
              <FaCalendarAlt />
            </div>

            <div>
              <h2>À venir</h2>
              <span />
            </div>
          </div>

          {events.map((event, index) => (
            <div className="event-card" key={index}>

              <div className="event-date">
                <strong>{event.day}</strong>
                <span>{event.month}</span>
              </div>

              <div className="event-image">
                <img src={event.image} alt={event.title} />
              </div>

              <div className="event-content">

                <h3>{event.title}</h3>

                <p>{event.description}</p>

                <div className="event-meta">

                  <span>
                    <FaClock />
                    {event.time}
                  </span>

                  <span>
                    <FaMapMarkerAlt />
                    {event.location}
                  </span>

                </div>

              </div>

              <button className="event-arrow">
                <FaArrowRight />
              </button>

            </div>
          ))}

          <button className="all-events-btn">
            Voir tous les événements
            <FaArrowRight />
          </button>

        </div>

        <div className="upcoming-events__right">

          <div className="calendar-card">

            <h3>
              <FaCalendarAlt />
              Calendrier
            </h3>

            <CalendarWidget />

          </div>

          <div className="newsletter-card">

            <div className="newsletter-content">

              <h3>
                Ne manquez aucun événement !
              </h3>

              <span />

              <p>
                Abonnez-vous à notre newsletter pour recevoir
                toutes les actualités et invitations.
              </p>

              <button>
                S'abonner
                <FaArrowRight />
              </button>

            </div>

            <img
              src={phoneNewsletter}
              alt="Newsletter"
            />

          </div>

          <div className="proposal-card">

            <div className="proposal-icon">
              <FaHeart />
            </div>

            <div>

              <h3>
                Un événement à proposer ?
              </h3>

              <p>
                Vous souhaitez organiser un événement
                au sein de notre église ?
              </p>

              <button>
                Nous contacter
                <FaArrowRight />
              </button>

            </div>

          </div>

        </div>

      </div>
    </section>
  );
};

export default UpcomingEvents;