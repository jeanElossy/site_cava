import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";

import EventsHero from "../../components/EventsHero";
import UpcomingEvents from "../../components/UpcomingEvents";
import EventsSidebar from "../../components/EventsSidebar/EventsSidebar";

import usePageMeta from "../../hooks/usePageMeta";

import "./Events.scss";

const Events = () => {
  usePageMeta({
    title: "Événements",
    description:
      "Cultes, réunions de prière, conférences et rencontres : retrouvez tous les prochains événements du Centre Apostolique Vie et Abondance à Abidjan.",
  });

  return (
    <>
      <Navbar />

      <main className="events-page">

        <EventsHero />

        <section className="events-layout">

          <div className="events-layout__left">
            <UpcomingEvents />
          </div>

          <div className="events-layout__right">
            <EventsSidebar />
          </div>

        </section>

      </main>

      <Footer />
    </>
  );
};

export default Events;