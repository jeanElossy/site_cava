import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import User from "../models/User.js";

// Extrait le jeton de l'en-tête `Authorization: Bearer <token>`.
const extractToken = (req) => {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) return null;

  const token = header.slice(7).trim();

  return token || null;
};

// PORTÉE DES JETONS — à ne pas retirer.
//
// Deux jetons circulent désormais, signés avec le même secret :
//
//   session   plein accès à l'administration
//   2fa       preuve que le mot de passe est bon, RIEN DE PLUS,
//             valable le temps de saisir le code
//
// Sans la portée, les deux seraient interchangeables et la double
// authentification serait contournable : il suffirait de présenter le
// jeton intermédiaire à une route d'administration. C'est l'erreur
// classique des implémentations 2FA maison, et elle annule tout le
// bénéfice de la fonctionnalité.
export const TOKEN_SCOPE = {
  SESSION: "session",
  TWO_FACTOR: "2fa",
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

  req.user = {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
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
