import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { extractToken } from "./auth.js";
import Member from "../models/Member.js";
import User from "../models/User.js";
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
  // SOA = Service-Ordre-Accueil. C'est littéralement le métier du
  // badgeage : un membre dont la fiche porte ce rôle y a droit sans
  // avoir besoin d'un compte agent.
  // « cana » et « coordinateur_bergeries » en restent exclus — ils
  // décrivent le circuit des nouvelles âmes, pas le badgeage.
  "soa",
];

// Rôles de COMPTE AGENT (User) habilités au badgeage.
//
// Le module Agents (/admin/agents) est arrivé APRÈS le badgeage : la
// règle ci-dessus ne connaissait que le rôle ecclésial porté par la
// fiche membre, et un compte agent créé exprès pour badger restait
// sans le moindre effet — constaté sur un agent SOA à qui le scanner
// répondait « Matricule inconnu ou non habilité ».
//
// Un compte que l'administration a délibérément créé est une
// habilitation au moins aussi explicite qu'un rôle ecclésial. Les
// rôles du module social et le circuit CANA/coordonnateur en sont
// exclus : ils désignent un autre métier, pas le Service-Ordre-Accueil.
export const PRESENCE_AGENT_ACCOUNT_ROLES = ["admin", "soa", "pasteur"];

// Un membre peut badger s'il est actif ET qu'il porte soit un rôle
// ecclésial habilité, soit un compte agent actif habilité.
//
// Point d'entrée UNIQUE de cette décision : les trois endroits qui la
// prennent (connexion de l'agent, vérification de sa session, et
// l'authentification du module Nouvelles âmes qui accepte le même
// jeton) doivent répondre pareil. Les laisser diverger ferait passer
// la connexion pour ensuite refuser chaque requête suivante.
export const isPresenceAgent = async (member) => {
  if (!member || member.status !== "actif") return false;

  if (PRESENCE_AGENT_ROLES.includes(member.role)) return true;

  if (!member.registrationNumber) return false;

  const account = await User.findOne({
    registrationNumber: member.registrationNumber,
  })
    .select("role isActive")
    .lean();

  return Boolean(
    account &&
      account.isActive !== false &&
      PRESENCE_AGENT_ACCOUNT_ROLES.includes(account.role)
  );
};

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

  if (!(await isPresenceAgent(agent))) {
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
