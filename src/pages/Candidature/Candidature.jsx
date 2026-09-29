import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";

import usePageMeta from "../../hooks/usePageMeta";

import CandidatureHero from "../../components/candidature/CandidatureHero/CandidatureHero";
import OpenPositions from "../../components/candidature/OpenPositions/OpenPositions";
import CandidatureCta from "../../components/candidature/CandidatureCta/CandidatureCta";
import CandidatureProcess from "../../components/candidature/CandidatureProcess/CandidatureProcess";
import CandidatureRequirements from "../../components/candidature/CandidatureRequirements/CandidatureRequirements";
import CandidatureForm from "../../components/candidature/CandidatureForm/CandidatureForm";
import CandidatureValues from "../../components/candidature/CandidatureValues/CandidatureValues";

// Page → sections, comme le reste du site : pas de layout partagé, la
// page monte elle-même sa Navbar et son Footer.
const Candidature = () => {
  usePageMeta({
    title: "Appel à candidatures",
    description:
      "ÇA.VA. recherche des hommes et des femmes disposés à mettre leurs dons, leurs compétences et leur disponibilité au service de la vision. Découvrez les postes ouverts et candidatez en ligne.",
  });

  return (
    <>
      <Navbar />

      <CandidatureHero />

      <OpenPositions />

      <CandidatureCta />

      <CandidatureProcess />

      <CandidatureRequirements />

      <CandidatureForm />

      <CandidatureValues />

      <Footer />
    </>
  );
};

export default Candidature;
