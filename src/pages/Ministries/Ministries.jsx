import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";

import MinistriesHero from "../../components/MinistriesHero";
import MinistriesGrid from "../../components/MinistriesGrid";
import MinistriesCallToAction from "../../components/MinistriesCallToAction";
import MinistriesStats from "../../components/MinistriesStats";

import "./Ministries.scss";

const Ministries = () => {
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