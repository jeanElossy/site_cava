import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";

import MinistriesHero from "../../components/MinistriesHero";
import MinistriesGrid from "../../components/MinistriesGrid";
import MinistriesCallToAction from "../../components/MinistriesCallToAction";
import MinistriesStats from "../../components/MinistriesStats";

import usePageMeta from "../../hooks/usePageMeta";

import "./Ministries.scss";

const Ministries = () => {
  usePageMeta({
    title: "Nos ministères",
    description:
      "Découvrez les ministères du Centre Apostolique Vie et Abondance à Abidjan : enfance et jeunesse, louange, enseignement, groupes de maison, action sociale et évangélisation.",
  });

  return (
    <>
      <Navbar />

      <main className="ministries-page">
        <MinistriesHero />
        <MinistriesGrid />
        <MinistriesCallToAction />
        <MinistriesStats />
      </main>

      <Footer />
    </>
  );
};

export default Ministries;