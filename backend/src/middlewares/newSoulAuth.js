import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { extractToken, TOKEN_SCOPE } from "./auth.js";
import { PRESENCE_TOKEN_SCOPE, isPresenceAgent } from "./presenceAuth.js";
import { getEffectiveWindow } from "../utils/presenceQrWindow.js";
import User from "../models/User.js";
import Member from "../models/Member.js";
import PresenceSecurityQr from "../models/PresenceSecurityQr.js";

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
// Ce middleware applique désormais les MÊMES contrôles que les deux
// authentifications dont il accepte les jetons : le verrou du mot de
// passe temporaire côté compte `User` (comme `requireAuth`), et la
// revérification du QR de sécurité côté agent de présence (comme
// `requirePresenceSession`). Il avait d'abord été simplifié sur ces
// deux points ; l'audit de sécurité a montré que la simplification
// rendait une réinitialisation de mot de passe et une révocation de QR
// seulement partielles sur ce module.
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

    // Même verrou que `requireAuth` (auth.js) : un mot de passe
    // redevenu temporaire — le geste d'un administrateur qui pense un
    // compte compromis — doit couper la session EN COURS, ici aussi.
    // Sans cette ligne, la réinitialisation ne fermait qu'une partie
    // des portes : un jeton déjà délivré restait valable sur ce module
    // jusqu'à sept jours.
    if (user.passwordChangeRequired) {
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

    // Même règle qu'au badgeage, et pour cause : c'est le MÊME jeton de
    // session. Une règle plus stricte ici refuserait un agent que le
    // scanner vient d'accepter.
    if (!(await isPresenceAgent(member))) {
      throw ApiError.unauthorized("Session invalide ou expirée.");
    }

    // Le QR de sécurité ayant servi à la connexion doit être TOUJOURS
    // actif — comme dans `requirePresenceSession`. Sans cette
    // vérification, révoquer un QR ne coupait pas la création de
    // dossiers SOA d'un agent déjà connecté : la révocation restait
    // partielle jusqu'à l'expiration propre du jeton (6 h au plus).
    // Une lecture de plus par requête, sur un module à faible trafic.
    const qr = await PresenceSecurityQr.findOne({ jti: payload.qrJti }).lean();
    const now = new Date();
    const { validUntil } = getEffectiveWindow(qr ?? {});

    if (!qr || qr.status !== "active" || !validUntil || now > validUntil) {
      throw ApiError.unauthorized(
        "Le QR de sécurité de cette session n'est plus valide."
      );
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
