import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";

import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";

import MinistryHero from "../../components/MinistryDetails/MinistryHero";
import MinistryMission from "../../components/MinistryDetails/MinistryMission";
import MinistryLeaders from "../../components/MinistryDetails/MinistryLeaders";
import MinistryGallery from "../../components/MinistryDetails/MinistryGallery";
import MinistryEvents from "../../components/MinistryDetails/MinistryEvents";
import MinistryTestimonials from "../../components/MinistryDetails/MinistryTestimonials";
import MinistryCTA from "../../components/MinistryDetails/MinistryCTA";

import ministries from "../../components/MinistryDetails/data/ministries";

import usePageMeta from "../../hooks/usePageMeta";

import "./MinistryDetails.scss";

const MinistryDetails = () => {
  const { slug } = useParams();

  // `Object.hasOwn` évite qu'un slug comme "constructor" ou "toString"
  // remonte une propriété héritée du prototype et fasse planter le rendu.
  const ministry =
    slug && Object.hasOwn(ministries, slug) ? ministries[slug] : null;

  usePageMeta({
    title: ministry ? ministry.title : "Ministère introuvable",
    description: ministry
      ? ministry.description
      : "Ce ministère n'existe pas ou n'est plus disponible.",
  });

  // Une navigation entre deux ministères ne change que le paramètre d'URL :
  // sans cela, la nouvelle page s'ouvrirait au milieu du défilement précédent.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (!ministry) {
    return (
      <>
        <Navbar />

        <main className="ministry-details ministry-details--missing">
          <h1>Ministère introuvable</h1>

          <p>
            Ce ministère n'existe pas ou n'est plus disponible.
          </p>

          <Link
            to="/ministries"
            className="ministry-details__back"
          >
            Voir tous nos ministères
          </Link>
        </main>

        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />

      <main className="ministry-details">
        <MinistryHero ministry={ministry} />

        <MinistryMission ministry={ministry} />

        <MinistryLeaders leaders={ministry.leaders} />

        <MinistryGallery
          images={ministry.gallery}
          ministryTitle={ministry.title}
        />

        <MinistryEvents events={ministry.events} />

        <MinistryTestimonials
          testimonials={ministry.testimonials}
        />

        <MinistryCTA ministry={ministry} />
      </main>

      <Footer />
    </>
  );
};

export default MinistryDetails;
