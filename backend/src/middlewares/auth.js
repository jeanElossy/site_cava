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

export const signToken = (user) =>
  jwt.sign(
    { sub: String(user._id), role: user.role },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN,
      issuer: env.JWT_ISSUER,
    }
  );

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

  const user = await User.findById(payload.sub).lean();

  if (!user || !user.isActive) {
    throw ApiError.unauthorized("Session invalide ou expirée.");
  }

  req.user = {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
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
