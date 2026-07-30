import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";

import usePageMeta from "../../hooks/usePageMeta";

import { RegistrationProvider } from "../../context/RegistrationContext";
import RegistrationHero from "../../components/registration/RegistrationHero";
import RegistrationForm from "../../components/registration/RegistrationForm";

const Registration = () => {
  usePageMeta({
    title: "Inscription des membres",
    description:
      "Inscrivez-vous comme nouveau membre du Centre Apostolique Vie et Abondance, ou mettez à jour votre fiche si vous possédez déjà un matricule.",
  });

  return (
    <>
      <Navbar />

      <RegistrationHero />

      <RegistrationProvider>
        <RegistrationForm />
      </RegistrationProvider>

      <Footer />
    </>
  );
};

export default Registration;
