import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import User from "../models/User.js";

// Extrait le jeton de l'en-tête `Authorization: Bearer <token>`.
//
// Exporté : `presenceAuth.js` le réutilise pour le jeton de session
// agent du badgeage, qui partage le même en-tête `Authorization` mais
// une portée (`scope`) totalement distincte des jetons ci-dessous.
export const extractToken = (req) => {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) return null;

  const token = header.slice(7).trim();

  return token || null;
};

// PORTÉE DES JETONS — à ne pas retirer.
//
// Trois jetons circulent désormais, signés avec le même secret :
//
//   session          plein accès à l'administration
//   2fa              preuve que le mot de passe est bon, RIEN DE PLUS,
//                    valable le temps de saisir le code
//   password_change  preuve qu'un mot de passe TEMPORAIRE est bon —
//                    n'ouvre QUE le changement de ce mot de passe
//
// Sans la portée, les trois seraient interchangeables et la double
// authentification serait contournable : il suffirait de présenter le
// jeton intermédiaire à une route d'administration. C'est l'erreur
// classique des implémentations 2FA maison, et elle annule tout le
// bénéfice de la fonctionnalité.
//
// Même raisonnement pour `password_change` : délivrer un vrai jeton de
// session et se contenter de bloquer les routes par un middleware
// laisserait un jeton pleinement valide en circulation — il suffirait
// d'oublier ce middleware sur UNE route pour ouvrir tout l'accès à un
// compte dont le mot de passe est encore connu de l'administrateur qui
// l'a créé.
export const TOKEN_SCOPE = {
  SESSION: "session",
  TWO_FACTOR: "2fa",
  PASSWORD_CHANGE: "password_change",
};

export const signToken = (user) =>
  jwt.sign(
    {
      sub: String(user._id),
      role: user.role,
      scope: TOKEN_SCOPE.SESSION,
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN,
      issuer: env.JWT_ISSUER,
    }
  );

// Jeton intermédiaire, délibérément très court : il n'ouvre rien et ne
// sert qu'à relier la saisie du code à la vérification du mot de passe
// qui vient d'aboutir.
export const signChallengeToken = (user) =>
  jwt.sign(
    {
      sub: String(user._id),
      scope: TOKEN_SCOPE.TWO_FACTOR,
    },
    env.JWT_SECRET,
    {
      expiresIn: "5m",
      issuer: env.JWT_ISSUER,
    }
  );

export const verifyChallengeToken = (token) => {
  let payload;

  try {
    payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: env.JWT_ISSUER,
    });
  } catch {
    return null;
  }

  // Symétrique de `requireAuth` : un jeton de session ne doit pas non
  // plus pouvoir se faire passer pour un jeton de vérification.
  if (payload.scope !== TOKEN_SCOPE.TWO_FACTOR) return null;

  return payload;
};

// Jeton du changement de mot de passe forcé — même principe que le
// jeton 2FA ci-dessus : il n'ouvre RIEN d'autre que la route qui pose
// le nouveau mot de passe.
//
// 15 minutes plutôt que 5 : contrairement à la saisie d'un code TOTP
// affiché sur un téléphone, le titulaire doit ici choisir un mot de
// passe d'au moins 12 caractères, le saisir deux fois, et le plus
// souvent le noter quelque part. Cinq minutes le mettraient dehors au
// milieu de sa première connexion.
export const signPasswordChangeToken = (user) =>
  jwt.sign(
    {
      sub: String(user._id),
      scope: TOKEN_SCOPE.PASSWORD_CHANGE,
    },
    env.JWT_SECRET,
    {
      expiresIn: "15m",
      issuer: env.JWT_ISSUER,
    }
  );

export const verifyPasswordChangeToken = (token) => {
  let payload;

  try {
    payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: env.JWT_ISSUER,
    });
  } catch {
    return null;
  }

  if (payload.scope !== TOKEN_SCOPE.PASSWORD_CHANGE) return null;

  return payload;
};


// Vérifie le jeton PUIS recharge l'utilisateur en base.
//
// Le rechargement n'est pas superflu : un compte désactivé ou supprimé
// doit perdre l'accès immédiatement, alors que son jeton reste
// techniquement valide jusqu'à expiration. Se fier au seul contenu du
// jeton laisserait un ancien administrateur entrer pendant des jours.
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);

  if (!token) {
    throw ApiError.unauthorized(
      "Authentification requise."
    );
  }

  let payload;

  try {
    payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: env.JWT_ISSUER,
    });
  } catch {
    // Message volontairement identique pour un jeton expiré ou
    // falsifié : distinguer les deux renseignerait un attaquant.
    throw ApiError.unauthorized("Session invalide ou expirée.");
  }

  // Le verrou de la double authentification. Un jeton de portée « 2fa »
  // prouve seulement que le mot de passe était correct : il ne doit
  // ouvrir aucune route d'administration.
  if (payload.scope !== TOKEN_SCOPE.SESSION) {
    throw ApiError.unauthorized("Session invalide ou expirée.");
  }

  const user = await User.findById(payload.sub).lean();

  if (!user || !user.isActive) {
    throw ApiError.unauthorized("Session invalide ou expirée.");
  }

  // Un mot de passe redevenu temporaire coupe la session EN COURS.
  //
  // Le cas visé : un administrateur réinitialise le mot de passe d'un
  // compte qu'il pense compromis. Sans cette vérification, le jeton
  // déjà délivré resterait valide jusqu'à sept jours — la
  // réinitialisation n'aurait fermé aucune porte. Même raisonnement que
  // le rechargement en base juste au-dessus, pour la désactivation.
  if (user.passwordChangeRequired) {
    throw ApiError.unauthorized(
      "Votre mot de passe est temporaire : reconnectez-vous pour en définir un nouveau."
    );
  }

  req.user = {
    id: String(user._id),
    name: user.name,
    email: user.email,
    registrationNumber: user.registrationNumber,
    role: user.role,
    // Portée facultative (voir User.js) : `undefined` pour tous les
    // comptes existants, donc aucun filtre appliqué.
    church: user.church,
    twoFactorEnabled: Boolean(user.twoFactor?.enabled),
  };

  next();
});

// À utiliser APRÈS `requireAuth`.
export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) {
      return next(
        ApiError.unauthorized("Authentification requise.")
      );
    }

    if (!roles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          "Votre rôle ne permet pas cette action."
        )
      );
    }

    next();
  };
