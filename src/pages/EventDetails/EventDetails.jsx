import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";

import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";

import EventHero from "../../components/EventDetails/EventHero";
import EventDescription from "../../components/EventDetails/EventDescription";
import EventInfo from "../../components/EventDetails/EventInfo";
import EventSpeaker from "../../components/EventDetails/EventSpeaker";
import EventCTA from "../../components/EventDetails/EventCTA";

import events from "../../components/EventDetails/data/events";

import usePageMeta from "../../hooks/usePageMeta";

import "./EventDetails.scss";

const EventDetails = () => {
  const { slug } = useParams();

  // `Object.hasOwn` évite qu'un slug comme "constructor" ou "toString"
  // remonte une propriété héritée du prototype et fasse planter le rendu.
  const event =
    slug && Object.hasOwn(events, slug) ? events[slug] : null;

  usePageMeta({
    title: event ? event.title : "Événement introuvable",
    description: event
      ? event.description
      : "Cet événement n'existe pas ou n'est plus disponible.",
  });

  // Une navigation entre deux événements ne change que le paramètre d'URL :
  // sans cela, la nouvelle page s'ouvrirait au milieu du défilement précédent.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (!event) {
    return (
      <>
        <Navbar />

        <main className="event-details event-details--missing">
          <h1>Événement introuvable</h1>

          <p>Cet événement n'existe pas ou n'est plus disponible.</p>

          <Link to="/events" className="event-details__back">
            Voir tous nos événements
          </Link>
        </main>

        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />

      <main className="event-details">
        <EventHero event={event} />

        <EventDescription event={event} />

        <EventInfo event={event} />

        <EventSpeaker speaker={event.speaker} />

        <EventCTA event={event} />
      </main>

      <Footer />
    </>
  );
};

export default EventDetails;
