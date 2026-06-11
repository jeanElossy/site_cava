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

import "./Donate.scss";

const Donate = () => {
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

        <ContributionStats />

        <ContributionTypes />

        <ContributionForm />

        <ProjectsProgress />

        <TransparencySection />

        <ImpactSection />

        <Testimonials />

        <FaqSection />

        <VerseSection />

      </main>

      <Footer />
    </>
  );
};

export default Donate;