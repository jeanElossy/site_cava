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

  // Préremplissage depuis l'URL — c'est ce qui donne son intérêt au QR
  // code projeté pendant un culte : le visiteur arrive avec le type et
  // le montant déjà choisis.
  useEffect(() => {
    const type = searchParams.get("type");

    if (type) {
      dispatch({ type: "SET_TYPE", payload: type });
    }

    const amount = Number(searchParams.get("amount"));

    // Validé avant d'être appliqué : la valeur vient de l'URL, donc de
    // n'importe qui. Un montant négatif ou fantaisiste n'a pas à
    // atterrir dans le formulaire — le serveur le refuserait de toute
    // façon, mais le visiteur verrait d'abord une somme absurde.
    if (Number.isInteger(amount) && amount >= 200 && amount <= 10000000) {
      dispatch({ type: "SET_AMOUNT", payload: amount });
    }

    const project = searchParams.get("project");

    if (project) {
      dispatch({ type: "SET_PROJECT", payload: project });
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

        {/*
          `ImpactSection` a été retiré d'ici.

          C'est le MÊME composant que la carte d'impact du récapitulatif
          du tunnel, juste au-dessus : le visiteur voyait donc deux fois
          la même carte sur un seul écran de défilement, et les deux
          réagissaient ensemble au montant saisi.

          Sa place est dans le récapitulatif, où elle répond aux choix
          en cours. Isolée, elle ne commentait rien.
        */}
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