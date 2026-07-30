import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";

import usePageMeta from "../../hooks/usePageMeta";

import { RegistrationProvider } from "../../context/RegistrationContext";
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

      <section className="registration-hero">
        <div className="registration-hero__container">
          <h1>Devenir membre</h1>

          <p>
            Que vous rejoigniez la famille CAVA pour la première fois
            ou que vous possédiez déjà un matricule, cette page vous
            permet de déclarer ou de mettre à jour vos informations.
            Une équipe vérifie chaque demande avant son enregistrement
            définitif.
          </p>
        </div>
      </section>

      <RegistrationProvider>
        <RegistrationForm />
      </RegistrationProvider>

      <Footer />
    </>
  );
};

export default Registration;
