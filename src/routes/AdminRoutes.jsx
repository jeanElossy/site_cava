import { Navigate, Route, Routes } from "react-router-dom";

import RequireAuth from "./RequireAuth";
import RequireRole from "./RequireRole";
import { SOCIAL_ROLES, STAFF_ROLES } from "./roleGroups";

import AdminLayout from "../pages/admin/AdminLayout";
import Login from "../pages/admin/Login";
import Dashboard from "../pages/admin/Dashboard";
import MediasAdmin from "../pages/admin/MediasAdmin";
import EventsAdmin from "../pages/admin/EventsAdmin";
import MinistriesAdmin from "../pages/admin/MinistriesAdmin";
import MessagesAdmin from "../pages/admin/MessagesAdmin";
import DonationsAdmin from "../pages/admin/DonationsAdmin";
import PaymentMethodsAdmin from "../pages/admin/PaymentMethodsAdmin";
import DonationTypesAdmin from "../pages/admin/DonationTypesAdmin";
import CommunityAdmin from "../pages/admin/CommunityAdmin";
import PresencesAdmin from "../pages/admin/PresencesAdmin";
import TestimonialsAdmin from "../pages/admin/TestimonialsAdmin";
import SubscribersAdmin from "../pages/admin/SubscribersAdmin";
import SettingsAdmin from "../pages/admin/SettingsAdmin";
import AgentsAdmin from "../pages/admin/AgentsAdmin";
import NewSoulsListPage from "../pages/admin/NewSouls/NewSoulsListPage";
import NewSoulDetailPage from "../pages/admin/NewSouls/NewSoulDetailPage";
import SocialDashboard from "../pages/admin/Social/SocialDashboard";
import SocialContributionsAdmin from "../pages/admin/Social/SocialContributionsAdmin";
import SocialMemberSearch from "../pages/admin/Social/SocialMemberSearch";
import SocialCaisse from "../pages/admin/Social/SocialCaisse";
import SocialAidsAdmin from "../pages/admin/Social/SocialAidsAdmin";
import SocialAidTypesAdmin from "../pages/admin/Social/SocialAidTypesAdmin";

/**
 * Toutes les routes de l'espace d'administration.
 *
 * Ce module est le point de chargement paresseux : `AppRoutes` l'importe
 * via `React.lazy`, ce qui isole l'admin dans son propre morceau de
 * bundle. Un visiteur du site public ne le télécharge jamais.
 *
 * ⚠️ Isoler le code n'est pas le protéger : `RequireAuth` est cosmétique
 * (voir `src/services/auth.js`). Toute personne qui demande /admin
 * téléchargera ce morceau.
 */
const AdminRoutes = () => {
  return (
    <Routes>
      <Route
        path="connexion"
        element={<Login />}
      />

      <Route
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route
          index
          element={<Dashboard />}
        />

        <Route
          path="medias"
          element={
            <RequireRole allow={STAFF_ROLES}>
              <MediasAdmin />
            </RequireRole>
          }
        />

        <Route
          path="evenements"
          element={
            <RequireRole allow={STAFF_ROLES}>
              <EventsAdmin />
            </RequireRole>
          }
        />

        <Route
          path="ministeres"
          element={
            <RequireRole allow={STAFF_ROLES}>
              <MinistriesAdmin />
            </RequireRole>
          }
        />

        <Route
          path="messages"
          element={
            <RequireRole allow={STAFF_ROLES}>
              <MessagesAdmin />
            </RequireRole>
          }
        />

        <Route
          path="dons"
          element={
            <RequireRole allow={STAFF_ROLES}>
              <DonationsAdmin />
            </RequireRole>
          }
        />

        <Route
          path="dons/moyens-de-paiement"
          element={
            <RequireRole allow={["admin"]}>
              <PaymentMethodsAdmin />
            </RequireRole>
          }
        />

        <Route
          path="dons/types"
          element={
            <RequireRole allow={["admin"]}>
              <DonationTypesAdmin />
            </RequireRole>
          }
        />

        <Route
          path="communaute"
          element={
            <RequireRole allow={STAFF_ROLES}>
              <CommunityAdmin />
            </RequireRole>
          }
        />

        <Route
          path="presences"
          element={
            <RequireRole allow={STAFF_ROLES}>
              <PresencesAdmin />
            </RequireRole>
          }
        />

        {/* Ouvertes à tous les rôles authentifiés : c'est le seul
            module que soa/cana/coordinateur_bergeries/pasteur voient
            une fois connectés (voir RequireRole.jsx). */}
        <Route
          path="nouvelles-ames"
          element={<NewSoulsListPage />}
        />

        <Route
          path="nouvelles-ames/:id"
          element={<NewSoulDetailPage />}
        />

        <Route
          path="temoignages"
          element={
            <RequireRole allow={STAFF_ROLES}>
              <TestimonialsAdmin />
            </RequireRole>
          }
        />

        <Route
          path="newsletter"
          element={
            <RequireRole allow={STAFF_ROLES}>
              <SubscribersAdmin />
            </RequireRole>
          }
        />

        <Route
          path="parametres"
          element={
            <RequireRole allow={STAFF_ROLES}>
              <SettingsAdmin />
            </RequireRole>
          }
        />

        {/* Gestion des comptes agents : réservée à l'admin, même
            editor n'y accède pas (voir agent.service.js). */}
        <Route
          path="agents"
          element={
            <RequireRole allow={["admin"]}>
              <AgentsAdmin />
            </RequireRole>
          }
        />

        {/* Module Service Social : cotisations, caisse, membres.
            SOCIAL_ROLES couvre lecture ET écriture — la distinction
            (ex. social_viewer sans bouton d'action) se fait à
            l'intérieur de chaque page via currentUser()?.role et
            SOCIAL_WRITE_ROLES, pas au niveau de la route (même
            approche que STAFF_ROLES pour /dons). */}
        <Route
          path="social"
          element={
            <RequireRole allow={SOCIAL_ROLES}>
              <SocialDashboard />
            </RequireRole>
          }
        />

        <Route
          path="social/cotisations"
          element={
            <RequireRole allow={SOCIAL_ROLES}>
              <SocialContributionsAdmin />
            </RequireRole>
          }
        />

        <Route
          path="social/membres"
          element={
            <RequireRole allow={SOCIAL_ROLES}>
              <SocialMemberSearch />
            </RequireRole>
          }
        />

        <Route
          path="social/caisse"
          element={
            <RequireRole allow={SOCIAL_ROLES}>
              <SocialCaisse />
            </RequireRole>
          }
        />

        {/* Aides sociales (Phase 2) : lecture ET écriture ouvertes à
            SOCIAL_ROLES, comme les autres écrans du module — la
            distinction par action (création, validation, annulation)
            se fait à l'intérieur de la page via currentUser()?.role,
            SOCIAL_WRITE_ROLES et SOCIAL_DECISION_ROLES. */}
        <Route
          path="social/aides"
          element={
            <RequireRole allow={SOCIAL_ROLES}>
              <SocialAidsAdmin />
            </RequireRole>
          }
        />

        {/* Types d'aide : plus restreint que le reste du module, comme
            "Moyens de paiement"/"Types de don" le sont déjà pour /dons. */}
        <Route
          path="social/aides/types"
          element={
            <RequireRole allow={["admin", "social_admin"]}>
              <SocialAidTypesAdmin />
            </RequireRole>
          }
        />
      </Route>

      <Route
        path="*"
        element={
          <Navigate
            to="/admin"
            replace
          />
        }
      />
    </Routes>
  );
};

export default AdminRoutes;
