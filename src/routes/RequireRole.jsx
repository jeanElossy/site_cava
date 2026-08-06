import { Navigate } from "react-router-dom";

import { currentUser } from "../services/auth";
import { AGENT_ROLES } from "./roleGroups";

/**
 * Garde de route par rôle, complémentaire à `RequireAuth` (qui ne
 * vérifie que la connexion). Un rôle non autorisé est renvoyé vers un
 * espace qu'il peut légitimement voir, plutôt que vers un écran vide.
 *
 * ⚠️ Comme `RequireAuth`, ceci reste cosmétique : la vraie barrière
 * est `requireRole(...)` côté API (voir routes/index.js). Ce composant
 * évite seulement d'afficher un écran qui échouerait de toute façon.
 */
const RequireRole = ({ allow, children }) => {
  const role = currentUser()?.role;

  if (allow.includes(role)) return children;

  const fallback = AGENT_ROLES.includes(role) ? "/admin/nouvelles-ames" : "/admin";

  return (
    <Navigate
      to={fallback}
      replace
    />
  );
};

export default RequireRole;
