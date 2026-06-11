import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";

import ContactHero from "../../components/ContactHero";
import ContactForm from "../../components/ContactForm";
import MinistryContacts from "../../components/MinistryContacts";
import VisitMap from "../../components/VisitMap";

const ContactPage = () => {
  return (
    <>
      <Navbar />

      <main>
        <ContactHero />
        <ContactForm />
        <MinistryContacts />
        <VisitMap />
      </main>

      <Footer />
    </>
  );
};

export default ContactPage;