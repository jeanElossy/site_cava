import { lazy, Suspense } from "react";

import { Routes, Route } from "react-router-dom";

import Home from "../pages/Home/Home";
import About from "../pages/About/About";
import Ministries from "../pages/Ministries/Ministries";
import MinistryDetails from "../pages/MinistryDetails/MinistryDetails";
import Events from "../pages/Events/Events";
import EventDetails from "../pages/EventDetails/EventDetails";
import Media from "../pages/Media/Media";
import Communaute from "../pages/Communaute/Communaute";
import Contact from "../pages/Contact/Contact";
import Donate from "../pages/Donate/Donate";
import DonationReturn from "../pages/DonationReturn/DonationReturn";
import LegalNotice from "../pages/LegalNotice/LegalNotice";
import PrivacyPolicy from "../pages/PrivacyPolicy/PrivacyPolicy";
import Unsubscribe from "../pages/Unsubscribe/Unsubscribe";
import NotFound from "../pages/NotFound/NotFound";

// INTERRUPTEUR DE DÉPLOIEMENT
//
// L'administration n'est incluse que si `VITE_ENABLE_ADMIN` vaut
// "true". Sur une build de production publique, la route /admin
// n'existe alors pas du tout : ni écran de connexion, ni bundle
// JavaScript téléchargeable, ni surface à sonder.
//
// Ce n'est PAS ce qui protège les données — c'est l'API qui refuse
// les requêtes non authentifiées. C'est une réduction de surface
// d'exposition, pas un mécanisme de sécurité.
//
// Pour activer l'admin sur un déploiement : définir VITE_ENABLE_ADMIN=true
// dans les variables d'environnement, et protéger l'accès en amont
// (mot de passe d'hébergement, préversion privée, ou réseau restreint).
const ADMIN_ENABLED =
  import.meta.env.VITE_ENABLE_ADMIN === "true" ||
  import.meta.env.DEV;

// L'import dynamique est placé DANS la branche conditionnelle, et non
// à la racine du module. Vite remplace `import.meta.env.*` par une
// littérale à la compilation : quand l'admin est désactivé, la branche
// devient du code mort et Rollup supprime l'`import()` — le chunk
// n'est alors même pas généré. Déclaré au niveau du module, il aurait
// été émis quoi qu'il arrive.
const AdminRoutes = ADMIN_ENABLED
  ? lazy(() => import("./AdminRoutes"))
  : null;

const AdminFallback = () => (
  <p
    style={{
      padding: "80px 20px",
      textAlign: "center",
      color: "#6a736e",
    }}
    role="status"
  >
    Chargement de l&apos;espace d&apos;administration…
  </p>
);

const AppRoutes = () => {
  return (
    <Routes>

      <Route
        path="/"
        element={<Home />}
      />

      <Route
        path="/about"
        element={<About />}
      />

      <Route
        path="/ministries"
        element={<Ministries />}
      />

      <Route
        path="/ministries/:slug"
        element={<MinistryDetails />}
      />
      

      <Route
        path="/events"
        element={<Events />}
      />

      <Route
        path="/events/:slug"
        element={<EventDetails />}
      />

      <Route
        path="/media"
        element={<Media />}
      />

      <Route
        path="/communaute"
        element={<Communaute />}
      />

      <Route
        path="/contact"
        element={<Contact />}
      />

      <Route
        path="/donate"
        element={<Donate />}
      />

      {/* Retour du donateur depuis le guichet de paiement. L'adresse
          est celle déclarée au prestataire (`return_url`) : la changer
          ici sans la changer côté serveur enverrait les donateurs sur
          une page introuvable après avoir payé. */}
      <Route
        path="/donate/retour"
        element={<DonationReturn />}
      />

      <Route
        path="/mentions-legales"
        element={<LegalNotice />}
      />

      <Route
        path="/politique-confidentialite"
        element={<PrivacyPolicy />}
      />

      {ADMIN_ENABLED && (
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<AdminFallback />}>
              <AdminRoutes />
            </Suspense>
          }
        />
      )}

      <Route
        path="/desinscription"
        element={<Unsubscribe />}
      />

      <Route
        path="*"
        element={<NotFound />}
      />

    </Routes>
  );
};

export default AppRoutes;

