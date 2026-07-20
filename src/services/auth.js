// Authentification de l'espace d'administration.
//
// ------------------------------------------------------------------
// AUTHENTIFICATION RÉELLE (JWT vérifié côté serveur)
// ------------------------------------------------------------------
// Ce module remplace l'implémentation factice précédente. Le mot de
// passe est désormais vérifié par l'API contre un hash bcrypt, et
// chaque route d'administration exige un jeton valide côté serveur.
//
// Point important : la protection ne repose plus sur l'interface.
// Masquer un écran côté React n'a jamais rien sécurisé — c'est l'API
// qui refuse les requêtes non authentifiées. `isAuthenticated()`
// ci-dessous ne sert qu'au confort de navigation.

import { request, setToken, getToken } from "./http";
import * as db from "./storage";

const USER_KEY = "admin-user";

export const currentUser = () => db.read(USER_KEY, null);

// Présence d'un jeton, sans garantie de validité : seul le serveur
// peut se prononcer. Une requête protégée renverra 401 si le jeton a
// expiré, et le client HTTP nettoiera la session.
export const isAuthenticated = () =>
  Boolean(getToken() && currentUser());

export const signIn = async ({ email, password }) => {
  if (!email?.trim() || !password) {
    throw new Error(
      "Merci de renseigner votre e-mail et votre mot de passe."
    );
  }

  const data = await request("/api/auth/login", {
    method: "POST",
    body: { email: email.trim(), password },
  });

  setToken(data.token);
  db.write(USER_KEY, data.user);

  return data.user;
};

export const signOut = () => {
  setToken(null);
  db.remove(USER_KEY);
};

// Revalide la session auprès du serveur au chargement de l'admin.
// Utile après une expiration : l'utilisateur est redirigé vers la
// connexion au lieu d'enchaîner des écrans vides.
export const refresh = async () => {
  if (!getToken()) return null;

  try {
    const user = await request("/api/auth/me", { auth: true });

    db.write(USER_KEY, user);

    return user;
  } catch {
    signOut();

    return null;
  }
};

export const changePassword = async (payload) =>
  request("/api/auth/change-password", {
    method: "POST",
    body: payload,
    auth: true,
  });
