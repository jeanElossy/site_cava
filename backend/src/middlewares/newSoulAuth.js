import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { extractToken, TOKEN_SCOPE } from "./auth.js";
import { PRESENCE_TOKEN_SCOPE, PRESENCE_AGENT_ROLES } from "./presenceAuth.js";
import User from "../models/User.js";
import Member from "../models/Member.js";

// Authentification du module Nouvelles Âmes — SEUL endroit du projet
// où un même jeu de routes accepte DEUX espaces d'identité distincts :
//
//   - un compte admin (`User`, jeton "session" de auth.js), pour les
//     rôles soa/cana/coordinateur_bergeries/pasteur/admin ;
//   - un agent de badgeage des présences (`Member`, jeton
//     "presence_session" de presenceAuth.js) — décision produit
//     explicite : n'importe quel agent de service d'ordre doit pouvoir
//     démarrer un dossier SOA depuis l'écran de scan, sans avoir de
//     compte admin séparé.
//
// Les deux jetons partagent le même secret mais des portées
// distinctes (voir le commentaire équivalent dans auth.js) : on
// décode une seule fois, puis on choisit la branche selon `scope`,
// plutôt que d'essayer les deux vérifications à l'aveugle.
//
// Simplification assumée : contrairement à `requirePresenceSession`,
// on ne revérifie pas ici que le QR de sécurité associé est toujours
// actif — seule l'expiration propre du jeton (calculée à la connexion
// à partir de la fenêtre du QR, voir signPresenceSessionToken) borne
// la session. Une révocation manuelle du QR pendant que l'agent est
// déjà connecté n'invaliderait donc pas immédiatement sa capacité à
// créer un dossier SOA — risque jugé acceptable pour cet usage
// secondaire (outil interne, jamais public).
export const requireNewSoulActor = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);

  if (!token) {
    throw ApiError.unauthorized("Authentification requise.");
  }

  let payload;

  try {
    payload = jwt.verify(token, env.JWT_SECRET, { issuer: env.JWT_ISSUER });
  } catch {
    throw ApiError.unauthorized("Session invalide ou expirée.");
  }

  if (payload.scope === TOKEN_SCOPE.SESSION) {
    const user = await User.findById(payload.sub).lean();

    if (!user || !user.isActive) {
      throw ApiError.unauthorized("Session invalide ou expirée.");
    }

    req.actor = {
      kind: "user",
      id: String(user._id),
      name: user.name,
      email: user.email,
      registrationNumber: user.registrationNumber,
      role: user.role,
    };

    return next();
  }

  if (payload.scope === PRESENCE_TOKEN_SCOPE.SESSION) {
    const member = await Member.findById(payload.sub).lean();

    if (!member || member.status !== "actif" || !PRESENCE_AGENT_ROLES.includes(member.role)) {
      throw ApiError.unauthorized("Session invalide ou expirée.");
    }

    req.actor = {
      kind: "member",
      id: String(member._id),
      name: `${member.firstName} ${member.lastName}`.trim(),
      email: member.email,
      registrationNumber: member.registrationNumber,
      role: member.role,
    };

    return next();
  }

  throw ApiError.unauthorized("Session invalide ou expirée.");
});
