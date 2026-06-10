import Header from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";

import DonationHero from "../../components/DonationHero";
import DonationForm from "../../components/DonationForm";
import DonationImpact from "../../components/DonationImpact";
import DonationVerse from "../../components/DonationVerse";
import DonationBenefits from "../../components/DonationBenefits";

import "./Donate.scss";

const Donate = () => {
  return (
    <>
      <Header />

      <main className="donation-page">

        <DonationHero />
        <DonationForm />
        <DonationImpact />
        <DonationVerse />
        <DonationBenefits />

      </main>

      <Footer />
    </>
  );
};

export default Donate;