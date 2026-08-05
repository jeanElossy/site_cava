import Member from "../models/Member.js";
import PresenceLogin from "../models/PresenceLogin.js";
import Attendance from "../models/Attendance.js";
import { ApiError } from "../utils/ApiError.js";
import { normalizeRegistrationNumber } from "./registrationNumber.service.js";
import { getEffectiveWindow } from "../utils/presenceQrWindow.js";
import * as presenceQrService from "./presenceQr.service.js";
import {
  signPresenceSessionToken,
  PRESENCE_AGENT_ROLES,
} from "../middlewares/presenceAuth.js";

// Connexion, scan et recherche du badgeage des présences. Voir
// docs/superpowers/specs/2026-08-04-badgeage-presences-design.md.

const serializeMember = (member) => ({
  id: String(member._id),
  firstName: member.firstName,
  lastName: member.lastName,
  photo: member.photo,
  registrationNumber: member.registrationNumber,
  area: member.area,
});

// Authentification d'un agent : QR de sécurité + matricule.
//
// Revérifie le QR même si le front vient tout juste de le faire via
// `qr/verify` — aucune route protégée ne doit se fier à une
// vérification déjà faite côté client.
export const agentLogin = async ({ token, matricule }, req) => {
  const verification = await presenceQrService.verifyToken(token);

  if (!verification.ok) {
    throw ApiError.unauthorized(
      presenceQrService.REASON_MESSAGES[verification.reason]
    );
  }

  const registrationNumber = normalizeRegistrationNumber(matricule);

  if (!registrationNumber) {
    throw ApiError.badRequest("Le matricule est obligatoire.");
  }

  const agent = await Member.findOne({ registrationNumber });

  // Message volontairement identique, matricule inconnu ou rôle non
  // habilité : distinguer les deux confirmerait à quelqu'un qui essaie
  // des matricules au hasard qu'il en a trouvé un qui existe.
  if (
    !agent ||
    agent.status !== "actif" ||
    !PRESENCE_AGENT_ROLES.includes(agent.role)
  ) {
    throw ApiError.unauthorized(
      "Matricule inconnu ou non habilité au badgeage."
    );
  }

  const sessionToken = signPresenceSessionToken({
    agent,
    qr: verification.qr,
  });

  await PresenceLogin.create({
    securityQr: verification.qr._id,
    agent: agent._id,
    ip: req?.ip,
    userAgent: req?.headers?.["user-agent"]?.slice(0, 300),
  });

  const { validFrom, validUntil } = getEffectiveWindow(verification.qr);

  return {
    sessionToken,
    agent: {
      firstName: agent.firstName,
      lastName: agent.lastName,
      photo: agent.photo,
      role: agent.role,
      registrationNumber: agent.registrationNumber,
    },
    qr: {
      label: verification.qr.label,
      validFrom,
      validUntil,
    },
  };
};

// Écrit la présence d'un MEMBRE si elle n'existe pas déjà pour ce
// membre et ce QR (index unique partiel `Attendance{member,
// securityQr}`, restreint à `kind: "member"` — voir Attendance.js) ;
// sinon renvoie l'enregistrement existant. S'appuie sur l'erreur de
// doublon plutôt que sur une lecture préalable, pour rester correct
// sous deux scans presque simultanés du même membre.
const recordMemberAttendance = async ({ member, securityQr, agentId, method, req }) => {
  try {
    const attendance = await Attendance.create({
      kind: "member",
      member: member._id,
      securityQr,
      agent: agentId,
      method,
      ip: req?.ip,
      userAgent: req?.headers?.["user-agent"]?.slice(0, 300),
    });

    return { attendance, alreadyRecorded: false };
  } catch (error) {
    if (error.code === 11000) {
      const existing = await Attendance.findOne({
        member: member._id,
        securityQr,
      });

      return { attendance: existing, alreadyRecorded: true };
    }

    throw error;
  }
};

export const scan = async ({ registrationNumber }, presenceAgent, presenceQr, req) => {
  const normalized = normalizeRegistrationNumber(registrationNumber);

  if (!normalized) {
    throw ApiError.badRequest("Matricule invalide.");
  }

  const member = await Member.findOne({ registrationNumber: normalized });

  // Même message qu'un matricule réellement inconnu : un membre
  // désactivé ne doit plus fonctionner nulle part sur le site, y
  // compris pour le badgeage.
  if (!member || member.status !== "actif") {
    throw ApiError.notFound("Aucun membre avec ce matricule.");
  }

  const { attendance, alreadyRecorded } = await recordMemberAttendance({
    member,
    securityQr: presenceQr._id,
    agentId: presenceAgent.id,
    method: "scan",
    req,
  });

  return {
    member: serializeMember(member),
    alreadyRecorded,
    recordedAt: attendance.recordedAt,
  };
};

export const mark = async ({ memberId }, presenceAgent, presenceQr, req) => {
  const member = await Member.findById(memberId);

  // `search()` (secours "carte oubliée") ne propose déjà que des
  // membres actifs, mais `memberId` reste un identifiant fourni par
  // l'appelant : à revérifier ici en défense en profondeur, plutôt
  // que de faire reposer la garantie sur le seul filtre de `search`.
  if (!member || member.status !== "actif") {
    throw ApiError.notFound("Membre introuvable.");
  }

  const { attendance, alreadyRecorded } = await recordMemberAttendance({
    member,
    securityQr: presenceQr._id,
    agentId: presenceAgent.id,
    method: "manual",
    req,
  });

  return {
    member: serializeMember(member),
    alreadyRecorded,
    recordedAt: attendance.recordedAt,
  };
};

// Présence d'un VISITEUR sans carte ni dossier `Member` — saisie
// directe par l'agent (nom, prénom, téléphone facultatif). Aucune
// déduplication possible (pas d'identité stable), donc toujours
// `alreadyRecorded: false` : chaque appel crée une nouvelle ligne.
export const markVisitor = async ({ firstName, lastName, phone }, presenceAgent, presenceQr, req) => {
  const cleanFirstName = String(firstName ?? "").trim();
  const cleanLastName = String(lastName ?? "").trim();

  if (!cleanFirstName || !cleanLastName) {
    throw ApiError.badRequest("Le prénom et le nom du visiteur sont obligatoires.");
  }

  const attendance = await Attendance.create({
    kind: "visitor",
    visitor: {
      firstName: cleanFirstName,
      lastName: cleanLastName,
      phone: phone ? String(phone).trim() : undefined,
    },
    securityQr: presenceQr._id,
    agent: presenceAgent.id,
    method: "manual",
    ip: req?.ip,
    userAgent: req?.headers?.["user-agent"]?.slice(0, 300),
  });

  return {
    visitor: {
      firstName: cleanFirstName,
      lastName: cleanLastName,
      phone: attendance.visitor.phone,
    },
    alreadyRecorded: false,
    recordedAt: attendance.recordedAt,
  };
};

// Secours « carte oubliée » : nom, prénom, matricule ou téléphone.
// Fonction dédiée plutôt que `listAdmin` générique du CRUD membres —
// celui-ci ne cherche pas sur le téléphone, exigé par la spec.
export const search = async (query) => {
  const safe = String(query ?? "").trim().slice(0, 80);

  if (!safe) return [];

  const escaped = safe.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = { $regex: escaped, $options: "i" };

  const members = await Member.find({
    status: "actif",
    $or: [
      { firstName: regex },
      { lastName: regex },
      { registrationNumber: regex },
      { phone: regex },
    ],
  })
    .select("firstName lastName photo registrationNumber phone area")
    .limit(15)
    .lean();

  return members.map((member) => ({
    id: String(member._id),
    firstName: member.firstName,
    lastName: member.lastName,
    photo: member.photo,
    registrationNumber: member.registrationNumber,
    phone: member.phone,
    area: member.area,
  }));
};

// Nombre de présences déjà enregistrées pour le QR de la session en
// cours, réparti membres/visiteurs — alimente le compteur "Présents"
// du scanner et le résumé de l'export admin. Donnée réelle plutôt
// qu'une statistique fabriquée (voir le point "hors périmètre" de la
// spec sur les statistiques avancées).
export const countAttendance = async (securityQr) => {
  const [members, visitors] = await Promise.all([
    Attendance.countDocuments({ securityQr, kind: "member" }),
    Attendance.countDocuments({ securityQr, kind: "visitor" }),
  ]);

  return { total: members + visitors, members, visitors };
};

// Présences enregistrées, pour le tableau de bord admin. Filtrable par
// QR de sécurité (un service donné) ; sinon les plus récentes toutes
// confondues.
export const listAttendance = async ({ securityQr, limit = 100 } = {}) => {
  const criteria = securityQr ? { securityQr } : {};
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

  const records = await Attendance.find(criteria)
    .sort({ recordedAt: -1 })
    .limit(safeLimit)
    .populate("member", "firstName lastName photo registrationNumber area")
    .populate("agent", "firstName lastName registrationNumber")
    .populate("securityQr", "label validFrom validUntil")
    .lean();

  return records.map((record) => ({
    id: String(record._id),
    kind: record.kind,
    method: record.method,
    recordedAt: record.recordedAt,
    member: record.member
      ? {
          id: String(record.member._id),
          firstName: record.member.firstName,
          lastName: record.member.lastName,
          photo: record.member.photo,
          registrationNumber: record.member.registrationNumber,
          area: record.member.area,
        }
      : null,
    visitor: record.kind === "visitor" ? record.visitor : null,
    agent: record.agent
      ? {
          firstName: record.agent.firstName,
          lastName: record.agent.lastName,
          registrationNumber: record.agent.registrationNumber,
        }
      : null,
    securityQr: record.securityQr
      ? {
          id: String(record.securityQr._id),
          label: record.securityQr.label,
        }
      : null,
  }));
};
