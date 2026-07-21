import { Navigate, Route, Routes } from "react-router-dom";

import RequireAuth from "./RequireAuth";

import AdminLayout from "../pages/admin/AdminLayout";
import Login from "../pages/admin/Login";
import Dashboard from "../pages/admin/Dashboard";
import MediasAdmin from "../pages/admin/MediasAdmin";
import EventsAdmin from "../pages/admin/EventsAdmin";
import MinistriesAdmin from "../pages/admin/MinistriesAdmin";
import MessagesAdmin from "../pages/admin/MessagesAdmin";
import DonationsAdmin from "../pages/admin/DonationsAdmin";
import CommunityAdmin from "../pages/admin/CommunityAdmin";
import SubscribersAdmin from "../pages/admin/SubscribersAdmin";
import SettingsAdmin from "../pages/admin/SettingsAdmin";

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
          element={<MediasAdmin />}
        />

        <Route
          path="evenements"
          element={<EventsAdmin />}
        />

        <Route
          path="ministeres"
          element={<MinistriesAdmin />}
        />

        <Route
          path="messages"
          element={<MessagesAdmin />}
        />

        <Route
          path="dons"
          element={<DonationsAdmin />}
        />

        <Route
          path="communaute"
          element={<CommunityAdmin />}
        />

        <Route
          path="newsletter"
          element={<SubscribersAdmin />}
        />

        <Route
          path="parametres"
          element={<SettingsAdmin />}
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
