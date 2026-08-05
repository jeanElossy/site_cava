import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { extractToken } from "./auth.js";
import Member from "../models/Member.js";
import PresenceSecurityQr from "../models/PresenceSecurityQr.js";
import { getEffectiveWindow } from "../utils/presenceQrWindow.js";

// Authentification du badgeage des présences — deux jetons distincts,
// signés avec le même `JWT_SECRET` que l'administration mais une
// portée séparée, sur le même principe que `TOKEN_SCOPE` dans
// `auth.js` : un jeton de l'un ne doit jamais ouvrir l'autre.
//
//   presence_qr        prouve qu'un lien encodé sur un QR imprimé a
//                       bien été signé par ce serveur — RIEN DE PLUS.
//                       Ne porte volontairement aucune expiration :
//                       la fenêtre de validité et la révocation
//                       restent décidées par `PresenceSecurityQr` en
//                       base, seule autorité, à chaque vérification
//                       (voir presenceQr.service.js#verifyToken). Un
//                       jeton qui expirerait de son côté créerait
//                       deux horloges à tenir synchronisées.
//   presence_session    ouvre le scanner de présence pour un agent
//                       déjà authentifié par matricule.
export const PRESENCE_TOKEN_SCOPE = {
  QR: "presence_qr",
  SESSION: "presence_session",
};

// Rôles habilités à devenir agent de badgeage. Un `role: "membre"`
// connaissant son propre matricule ne doit pas pouvoir ouvrir le
// scanner — décision explicite, pas un oubli.
export const PRESENCE_AGENT_ROLES = [
  "serviteur",
  "responsable",
  "pasteur",
  "chantre",
  "dirigeant",
];

const PRESENCE_SESSION_MAX_HOURS = 6;

export const signPresenceQrToken = (qr) =>
  jwt.sign(
    { jti: qr.jti, scope: PRESENCE_TOKEN_SCOPE.QR },
    env.JWT_SECRET,
    { issuer: env.JWT_ISSUER }
  );

export const verifyPresenceQrToken = (token) => {
  let payload;

  try {
    payload = jwt.verify(token, env.JWT_SECRET, { issuer: env.JWT_ISSUER });
  } catch {
    return null;
  }

  if (payload.scope !== PRESENCE_TOKEN_SCOPE.QR || typeof payload.jti !== "string") {
    return null;
  }

  return payload;
};

// Durée du jeton de session : le plus court entre 6h et la fin de
// validité EFFECTIVE du QR ayant servi à la connexion (activation +
// durée — voir utils/presenceQrWindow.js) — un agent connecté tôt dans
// un service de 5h ne garde jamais l'accès au-delà de sa fin. Appelé
// uniquement après un `verifyToken` réussi, qui a déjà activé le QR :
// `validUntil` n'est donc jamais nul ici.
export const signPresenceSessionToken = ({ agent, qr }) => {
  const { validUntil } = getEffectiveWindow(qr);
  const maxSessionEnd = Date.now() + PRESENCE_SESSION_MAX_HOURS * 60 * 60 * 1000;
  const expiresAt = Math.min(validUntil.getTime(), maxSessionEnd);
  const expiresInSeconds = Math.max(60, Math.ceil((expiresAt - Date.now()) / 1000));

  return jwt.sign(
    {
      sub: String(agent._id),
      qrJti: qr.jti,
      scope: PRESENCE_TOKEN_SCOPE.SESSION,
    },
    env.JWT_SECRET,
    { expiresIn: expiresInSeconds, issuer: env.JWT_ISSUER }
  );
};

// Vérifie le jeton de session PUIS revérifie l'agent et le QR
// d'origine en base — jamais de confiance au seul contenu du jeton.
//
// C'est ce qui rend une révocation de QR (ou un changement de rôle/
// désactivation de l'agent) effective IMMÉDIATEMENT, y compris pour un
// agent déjà en session au milieu d'un service : le prochain appel
// échoue, même si le jeton lui-même n'a pas encore expiré.
export const requirePresenceSession = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);

  if (!token) {
    throw ApiError.unauthorized("Connexion agent requise.");
  }

  let payload;

  try {
    payload = jwt.verify(token, env.JWT_SECRET, { issuer: env.JWT_ISSUER });
  } catch {
    throw ApiError.unauthorized("Session de badgeage invalide ou expirée.");
  }

  if (payload.scope !== PRESENCE_TOKEN_SCOPE.SESSION) {
    throw ApiError.unauthorized("Session de badgeage invalide ou expirée.");
  }

  const [agent, qr] = await Promise.all([
    Member.findById(payload.sub).lean(),
    PresenceSecurityQr.findOne({ jti: payload.qrJti }).lean(),
  ]);

  if (!agent || agent.status !== "actif" || !PRESENCE_AGENT_ROLES.includes(agent.role)) {
    throw ApiError.unauthorized("Session de badgeage invalide ou expirée.");
  }

  const now = new Date();
  const { validUntil } = getEffectiveWindow(qr ?? {});

  if (!qr || qr.status !== "active" || !validUntil || now > validUntil) {
    throw ApiError.unauthorized(
      "Le QR de sécurité de cette session n'est plus valide."
    );
  }

  req.presenceAgent = {
    id: String(agent._id),
    firstName: agent.firstName,
    lastName: agent.lastName,
    role: agent.role,
    registrationNumber: agent.registrationNumber,
  };
  req.presenceQr = qr;

  next();
});
