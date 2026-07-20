import { Navigate, useLocation } from "react-router-dom";

import { isAuthenticated } from "../services/auth";

/**
 * ⚠️ Garde-fou COSMÉTIQUE, pas une protection.
 *
 * Voir l'avertissement en tête de `src/services/auth.js` : la session
 * est une simple valeur de localStorage, que n'importe qui peut écrire
 * depuis la console, et tout le code de l'admin est de toute façon
 * téléchargeable. Ce composant sert uniquement à éviter d'afficher des
 * écrans vides à quelqu'un qui n'est pas passé par la connexion.
 *
 * La vraie protection devra être faite côté serveur, sur l'API.
 */
const RequireAuth = ({ children }) => {
  const location = useLocation();

  if (!isAuthenticated()) {
    return (
      <Navigate
        to="/admin/connexion"
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  return children;
};

export default RequireAuth;
