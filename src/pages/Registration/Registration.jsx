import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";

import usePageMeta from "../../hooks/usePageMeta";

import { RegistrationProvider } from "../../context/RegistrationContext";
import RegistrationHero from "../../components/registration/RegistrationHero";
import RegistrationForm from "../../components/registration/RegistrationForm";

import "./Registration.scss";

const Registration = () => {
  usePageMeta({
    title: "Inscription des membres",
    description:
      "Inscrivez-vous comme nouveau membre du Centre Apostolique Vie et Abondance, ou mettez à jour votre fiche si vous possédez déjà un matricule.",
  });

  return (
    <>
      <Navbar />

      {/* `<main>` : repère de navigation pour les lecteurs d'écran, comme
          sur les autres pages. */}
      <main className="registration-page">
        <RegistrationHero />

        <RegistrationProvider>
          <RegistrationForm />
        </RegistrationProvider>
      </main>

      <Footer />
    </>
  );
};

export default Registration;
