import Navbar from "../../components/Navbar/Navbar";
import Hero from "../../components/Hero/Hero";
import Values from "../../components/Values/Values";
import Events from "../../components/Events/Events";
import Verse from "../../components/Verse/Verse";
import LastMessage from "../../components/LastMessage/LastMessage";
import Ministries from "../../components/Ministries/Ministries";
import HomeVisit from "../../components/HomeVisit/HomeVisit";
import Footer from "../../components/Footer/Footer";

import usePageMeta from "../../hooks/usePageMeta";

import "./Home.scss";

const Home = () => {
  usePageMeta({
    title: "Accueil",
    description:
      "Le Centre Apostolique Vie et Abondance (CAVA) est une église d'Abidjan centrée sur Christ : cultes, ministères, événements et enseignements.",
  });

  return (
    <>
      <Navbar />

      <main className="home-page">
        <Hero />
        <Values />
        <Events />
        <Verse />
        <LastMessage />
        <Ministries />
        <HomeVisit />
      </main>

      <Footer />
    </>
  );
};

export default Home;
