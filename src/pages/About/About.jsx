import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import Header from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import AboutHero from "../../components/AboutHero";
import VisionMission from "../../components/VisionMission";
import AboutPillars from "../../components/AboutPillars/AboutPillars";
import ValuesSection from "../../components/ValuesSection";
import StatsSection from "../../components/StatsSection";
import JoinFamilySection from "../../components/JoinFamilySection";

import usePageMeta from "../../hooks/usePageMeta";

import "./About.scss";

const About = () => {
  const { hash } = useLocation();

  usePageMeta({
    title: "À propos",
    description:
      "Découvrez la vision, la mission et les valeurs du Centre Apostolique Vie et Abondance, une église centrée sur Christ à Abidjan.",
  });

  // Les pages des piliers renvoient vers `/about#piliers` : le routeur
  // ne fait pas défiler jusqu'à une ancre lors d'un changement de page.
  // `getElementById` et non `querySelector` : le fragment vient de l'URL,
  // il ne doit jamais être interprété comme un sélecteur CSS.
  useEffect(() => {
    if (!hash) return;

    document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <>
      <Header />

      <main className="about-page">
        <AboutHero />
        <VisionMission />
        <AboutPillars />
        <ValuesSection />
        <StatsSection />
        <JoinFamilySection />
      </main>

      <Footer />
    </>
  );
};

export default About;