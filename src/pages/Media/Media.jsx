import { useState } from "react";

import Header from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";

import MediaHero from "../../components/MediaHero/MediaHero";
import MediaFilters from "../../components/MediaFilters/MediaFilters";
import MediaSection from "../../components/MediaSection/MediaSection";
import SubscribeBanner from "../../components/SubscribeBanner/SubscribeBanner";

import MediaPlayerModal from "../../components/MediaPlayerModal/MediaPlayerModal";

import {
  messages,
  louanges,
  temoignages,
} from "../../components/Media/data/medias";

import usePageMeta from "../../hooks/usePageMeta";

import "./Media.scss";

export default function Media() {
  usePageMeta({
    title: "Médias",
    description:
      "Réécoutez les messages, les chants et les témoignages du Centre Apostolique Vie et Abondance à Abidjan.",
  });


  const [activeFilter, setActiveFilter] =
    useState("Tous");

  // Média actuellement ouvert dans le lecteur (null = fermé).
  const [playing, setPlaying] = useState(null);

  

  let sections = [];

  // Vue « Tous » : chaque bouton de section applique le filtre correspondant.
  // Dans une vue déjà filtrée, le bouton n'a plus de destination et n'est
  // donc pas rendu (MediaSection l'omet si `onButtonClick` est absent).
  if (activeFilter === "Tous") {
    sections = [
      {
        title: "Derniers messages",
        buttonText: "Voir tous les messages",
        onButtonClick: () => setActiveFilter("Messages"),
        items: messages
      },
      {
        title: "Louanges",
        buttonText: "Voir toutes les louanges",
        onButtonClick: () => setActiveFilter("Louanges"),
        items: louanges
      },
      {
        title: "Témoignages",
        buttonText: "Voir tous les témoignages",
        onButtonClick: () => setActiveFilter("Témoignages"),
        items: temoignages
      }
    ];
  }

  if (activeFilter === "Messages") {
    sections = [
      {
        title: "Derniers messages",
        items: messages
      }
    ];
  }

  if (activeFilter === "Louanges") {
    sections = [
      {
        title: "Louanges",
        items: louanges
      }
    ];
  }

  if (activeFilter === "Témoignages") {
    sections = [
      {
        title: "Témoignages",
        items: temoignages
      }
    ];
  }



  return (
    <>
      <Header />

      <main className="media-page">

        <MediaHero />

        <MediaFilters
          active={activeFilter}
          setActive={setActiveFilter}
        />

        {sections.map((section, index) => (
          <MediaSection
            key={index}
            title={section.title}
            buttonText={section.buttonText}
            onButtonClick={section.onButtonClick}
            onPlay={setPlaying}
            items={section.items}
          />
        ))}

        <SubscribeBanner />

      </main>

      <Footer />

      {/* Lecteur : le visiteur reste sur le site. */}
      <MediaPlayerModal
        item={playing}
        onClose={() => setPlaying(null)}
      />
    </>
  );
}