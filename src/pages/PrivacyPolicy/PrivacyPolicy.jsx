import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";

import LegalHero from "../../components/legal/LegalHero";
import LegalContent from "../../components/legal/LegalContent";

import { privacyPolicy } from "../../components/legal/data/legalContent";

import usePageMeta from "../../hooks/usePageMeta";

import "./PrivacyPolicy.scss";

const PrivacyPolicy = () => {
  usePageMeta({
    title: privacyPolicy.title,
    description:
      "Politique de confidentialité du Centre Apostolique Vie et Abondance : données collectées, finalités, durées de conservation et exercice de vos droits.",
  });

  return (
    <>
      <Navbar />

      <main className="privacy-page">
        <LegalHero
          title={privacyPolicy.title}
          intro={privacyPolicy.intro}
        />

        <LegalContent sections={privacyPolicy.sections} />
      </main>

      <Footer />
    </>
  );
};

export default PrivacyPolicy;
