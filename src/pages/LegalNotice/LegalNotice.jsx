import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";

import LegalHero from "../../components/legal/LegalHero";
import LegalContent from "../../components/legal/LegalContent";

import { legalNotice } from "../../components/legal/data/legalContent";

import usePageMeta from "../../hooks/usePageMeta";

import "./LegalNotice.scss";

const LegalNotice = () => {
  usePageMeta({
    title: legalNotice.title,
    description:
      "Mentions légales du site du Centre Apostolique Vie et Abondance : éditeur, responsable de la publication, hébergement et propriété intellectuelle.",
  });

  return (
    <>
      <Navbar />

      <main className="legal-page">
        <LegalHero
          title={legalNotice.title}
          intro={legalNotice.intro}
        />

        <LegalContent sections={legalNotice.sections} />
      </main>

      <Footer />
    </>
  );
};

export default LegalNotice;
