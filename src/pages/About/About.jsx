import Header from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import AboutHero from "../../components/AboutHero";
import VisionMission from "../../components/VisionMission";
import ValuesSection from "../../components/ValuesSection";
import StatsSection from "../../components/StatsSection";
import JoinFamilySection from "../../components/JoinFamilySection";

import usePageMeta from "../../hooks/usePageMeta";

import "./About.scss";

const About = () => {
  usePageMeta({
    title: "À propos",
    description:
      "Découvrez la vision, la mission et les valeurs du Centre Apostolique Vie et Abondance, une église centrée sur Christ à Abidjan.",
  });

  return (
    <>
      <Header />

      <main className="about-page">
        <AboutHero />
        <VisionMission />
        <ValuesSection />
        <StatsSection />
        <JoinFamilySection />

        {/* Les autres sections seront ajoutées ensuite */}
      </main>

      <Footer />
    </>
  );
};

export default About;