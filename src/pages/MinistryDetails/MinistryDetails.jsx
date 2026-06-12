import { useParams } from "react-router-dom";

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

const MinistryDetails = () => {
  const { slug } = useParams();

  const ministry = ministries[slug];

  if (!ministry) {
    return (
      <>
        <Navbar />

        <main
          style={{
            minHeight: "70vh",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <h1>Ministère introuvable</h1>
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

        <MinistryLeaders
          leaders={ministry.leaders || []}
        />

        <MinistryGallery
          images={ministry.gallery || []}
        />

        <MinistryEvents
          events={ministry.events || []}
        />

        <MinistryTestimonials
          testimonials={
            ministry.testimonials || []
          }
        />

        <MinistryCTA ministry={ministry} />

      </main>

      <Footer />
    </>
  );
};

export default MinistryDetails;