import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";

import CommunityHero from "../../components/communaute/CommunityHero";
import CommunityLife from "../../components/communaute/CommunityLife";
import HomeGroups from "../../components/communaute/HomeGroups";
import CommunityAnnouncements from "../../components/communaute/CommunityAnnouncements";
import CommunityTestimonials from "../../components/communaute/CommunityTestimonials";
import CommunityJoin from "../../components/communaute/CommunityJoin";

import usePageMeta from "../../hooks/usePageMeta";

import "./Communaute.scss";

const Communaute = () => {
  usePageMeta({
    title: "Notre communauté",
    description:
      "Découvrez la vie communautaire du Centre Apostolique Vie et Abondance à Abidjan : groupes de maison, annonces, témoignages et comment nous rejoindre.",
  });

  return (
    <>
      <Navbar />

      <main className="communaute-page">
        <CommunityHero />
        <CommunityLife />
        <HomeGroups />
        <CommunityAnnouncements />
        <CommunityTestimonials />
        <CommunityJoin />
      </main>

      <Footer />
    </>
  );
};

export default Communaute;
