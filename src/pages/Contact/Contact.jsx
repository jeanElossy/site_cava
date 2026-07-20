import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";

import ContactHero from "../../components/ContactHero";
import ContactForm from "../../components/ContactForm";
import ContactSchedule from "../../components/ContactSchedule/ContactSchedule";
import MinistryContacts from "../../components/MinistryContacts";
import VisitMap from "../../components/VisitMap";

import usePageMeta from "../../hooks/usePageMeta";

import "./Contact.scss";

const ContactPage = () => {
  usePageMeta({
    title: "Contact",
    description:
      "Contactez le Centre Apostolique Vie et Abondance à Abidjan : horaires des cultes, demande de prière, coordonnées et formulaire de contact.",
  });

  return (
    <>
      <Navbar />

      <main className="contact-page">
        <ContactHero />
        <ContactForm />
        <ContactSchedule />
        <MinistryContacts />
        <VisitMap />
      </main>

      <Footer />
    </>
  );
};

export default ContactPage;
