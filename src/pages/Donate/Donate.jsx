import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import Header from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";

import ContributionHero from "../../components/donate/ContributionHero";
import ContributionStats from "../../components/donate/ContributionStats";
import ContributionTypes from "../../components/donate/ContributionTypes";
import ContributionForm from "../../components/donate/ContributionForm";
import ProjectsProgress from "../../components/donate/ProjectsProgress";
import TransparencySection from "../../components/donate/TransparencySection";
import ImpactSection from "../../components/donate/ImpactSection";
import Testimonials from "../../components/donate/Testimonials";
import FaqSection from "../../components/donate/FaqSection";
import VerseSection from "../../components/donate/VerseSection";

import {
  useContribution,
} from "../../context/ContributionContext";

import usePageMeta from "../../hooks/usePageMeta";

import "./Donate.scss";

const Donate = () => {
  usePageMeta({
    title: "Faire un don",
    description:
      "Soutenez les projets et les actions du Centre Apostolique Vie et Abondance à Abidjan par un don ponctuel ou régulier.",
  });

  const [searchParams] =
    useSearchParams();

  const { dispatch } =
    useContribution();

  useEffect(() => {
    const type =
      searchParams.get("type");

    if (type) {
      dispatch({
        type: "SET_TYPE",
        payload: type,
      });
    }
  }, [searchParams, dispatch]);

  return (
    <>
      <Header />

      <main className="donate-page">

        <ContributionHero />

        {/*
          Le don est l'objectif unique de la page : le choix du type et le
          tunnel de contribution passent en tête, juste après le héros.
          Les sections de réassurance (impact, projets, transparence,
          témoignages) viennent ensuite nourrir la décision.
        */}
        <ContributionTypes />

        <ContributionForm />

        <ContributionStats />

        <ImpactSection />

        <ProjectsProgress />

        <TransparencySection />

        <Testimonials />

        <FaqSection />

        <VerseSection />

      </main>

      <Footer />
    </>
  );
};

export default Donate;