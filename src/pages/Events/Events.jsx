import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";

import EventsHero from "../../components/EventsHero";
import UpcomingEvents from "../../components/UpcomingEvents";

import "./Events.scss";

const Events = () => {
  return (
    <>
      <Navbar />

      <main className="events-page">

        <EventsHero />

        <section className="events-layout">

          <div className="events-layout__left">
            <UpcomingEvents />
          </div>

        </section>

      </main>

      <Footer />
    </>
  );
};

export default Events;