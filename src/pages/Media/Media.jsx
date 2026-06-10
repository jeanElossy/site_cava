import { useState } from "react";

import Header from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";

import MediaHero from "../../components/MediaHero/MediaHero";
import MediaFilters from "../../components/MediaFilters/MediaFilters";
import MediaSection from "../../components/MediaSection/MediaSection";
import SubscribeBanner from "../../components/SubscribeBanner/SubscribeBanner";

import "./Media.scss";

const messages = [
  {
    title: "Marcher par la foi",
    author: "Pasteur Jean Koffi",
    date: "04 Mai 2025",
    duration: "45:30",
    image: "/images/media/message1.jpg.png"
  },
  {
    title: "La puissance de la prière",
    author: "Pasteur Marcel N'Guessan",
    date: "27 Avril 2025",
    duration: "38:22",
    image: "/images/media/message2.jpg.png"
  },
  {
    title: "Vivre avec l'Esprit",
    author: "Pasteur Jean Koffi",
    date: "20 Avril 2025",
    duration: "42:16",
    image: "/images/media/message3.jpg.png"
  },
  {
    title: "La grâce qui transforme",
    author: "Pasteur Marcel N'Guessan",
    date: "13 Avril 2025",
    duration: "36:45",
    image: "/images/media/message4.jpg.png"
  }
];

const louanges = [
  {
    title: "Tout est possible",
    author: "CAVA Worship",
    duration: "03:52",
    image: "/images/media/song1.jpg.png"
  },
  {
    title: "Jésus tu es bon",
    author: "CAVA Worship",
    duration: "06:14",
    image: "/images/media/song2.jpg.png"
  },
  {
    title: "Ta présence",
    author: "CAVA Worship",
    duration: "07:08",
    image: "/images/media/song3.jpg.png"
  },
  {
    title: "Mon coeur t'appartient",
    author: "CAVA Worship",
    duration: "04:45",
    image: "/images/media/song4.jpg.png"
  }
];


const temoignages = [
  {
    title: "Dieu a changé ma vie",
    author: "Marie Kouassi",
    date: "11 Mai 2025",
    duration: "08:24",
    image: "/images/media/temoignage1.jpg.png"
  },
  {
    title: "Guéri par la grâce de Dieu",
    author: "Jean Baptiste",
    date: "04 Mai 2025",
    duration: "06:18",
    image: "/images/media/temoignage2.jpg.png"
  },
  {
    title: "Une restauration familiale",
    author: "Sarah N'Guessan",
    date: "27 Avril 2025",
    duration: "10:12",
    image: "/images/media/temoignage3.jpg.png"
  },
  {
    title: "De l'échec à la victoire",
    author: "Koffi Emmanuel",
    date: "20 Avril 2025",
    duration: "07:45",
    image: "/images/media/temoignage4.jpg.png"
  }
];



export default function Media() {

  const [activeFilter, setActiveFilter] =
  useState("Tous");

  

  let sections = [];

  if (activeFilter === "Tous") {
    sections = [
      {
        title: "Derniers messages",
        buttonText: "Voir tous les messages",
        items: messages
      },
      {
        title: "Louanges",
        buttonText: "Voir toutes les louanges",
        items: louanges
      },
      {
        title: "Témoignages",
        buttonText: "Voir tous les témoignages",
        items: temoignages
      }
    ];
  }

  if (activeFilter === "Messages") {
    sections = [
      {
        title: "Derniers messages",
        buttonText: "Voir tous les messages",
        items: messages
      }
    ];
  }

  if (activeFilter === "Louanges") {
    sections = [
      {
        title: "Louanges",
        buttonText: "Voir toutes les louanges",
        items: louanges
      }
    ];
  }

  if (activeFilter === "Témoignages") {
    sections = [
      {
        title: "Témoignages",
        buttonText: "Voir tous les témoignages",
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
            items={section.items}
          />
        ))}

        <SubscribeBanner />

      </main>

      <Footer />
    </>
  );
}