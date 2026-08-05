import { fileURLToPath } from "node:url";
import path from "node:path";

import PDFDocument from "pdfkit";

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

const LOGO_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../assets/logo-cava.png"
);

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

// Badges invités pré-imprimés — voir guestBadgeSvg.service.js. Le QR
// encode le même format d'URL que le matricule d'un membre
// (`?matricule=INV-HOMME-01`), donc le même code de décodage/scan
// frontend fonctionne sans modification ; seule la forme du code
// (préfixe "INV", jamais produit par un vrai matricule membre —
// voir registrationNumber.service.js) permet de le distinguer AVANT
// toute recherche en base. Comparé après normalisation (espaces/tirets
// retirés, majuscules), d'où l'absence de tiret dans le motif.
const GUEST_BADGE_PATTERN = /^INV(HOMME|FEMME)(0[1-5])$/;
const GUEST_BADGE_GENDER_LABELS = { HOMME: "Homme", FEMME: "Femme" };

export const parseGuestBadgeCode = (normalized) => {
  const match = GUEST_BADGE_PATTERN.exec(normalized ?? "");

  if (!match) return null;

  const [, genderCode, index] = match;

  return {
    code: `INV-${genderCode}-${index}`,
    gender: genderCode.toLowerCase(),
    index: Number(index),
    label: `Invité ${GUEST_BADGE_GENDER_LABELS[genderCode]} ${Number(index)}`,
  };
};

// Même principe que `recordMemberAttendance` (dédoublonnage par
// l'erreur d'index plutôt qu'une lecture préalable), mais pour un
// badge invité réutilisable : dédoublonné par `visitor.badgeCode`, pas
// par une identité de membre.
const recordGuestBadgeAttendance = async ({ badge, securityQr, agentId, req }) => {
  try {
    const attendance = await Attendance.create({
      kind: "visitor",
      visitor: {
        firstName: "Invité",
        lastName: `${GUEST_BADGE_GENDER_LABELS[badge.code.split("-")[1]]} ${badge.index}`,
        badgeCode: badge.code,
      },
      securityQr,
      agent: agentId,
      method: "scan",
      ip: req?.ip,
      userAgent: req?.headers?.["user-agent"]?.slice(0, 300),
    });

    return { attendance, alreadyRecorded: false };
  } catch (error) {
    if (error.code === 11000) {
      const existing = await Attendance.findOne({
        "visitor.badgeCode": badge.code,
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

  const badge = parseGuestBadgeCode(normalized);

  if (badge) {
    const { attendance, alreadyRecorded } = await recordGuestBadgeAttendance({
      badge,
      securityQr: presenceQr._id,
      agentId: presenceAgent.id,
      req,
    });

    return {
      kind: "visitor",
      visitor: { firstName: attendance.visitor.firstName, lastName: attendance.visitor.lastName },
      alreadyRecorded,
      recordedAt: attendance.recordedAt,
    };
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
    kind: "member",
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

// Visiteurs enregistrés pour LE service en cours (un seul QR) —
// utilisé par l'écran de scan lui-même pour afficher la liste à
// l'agent (export PDF, démarrage d'un dossier SOA) : uniquement
// nom/prénom, jamais le téléphone ni l'identité de l'agent qui a
// badgé, non pertinents pour cet usage.
export const listVisitors = async (securityQr) => {
  const records = await Attendance.find({ securityQr, kind: "visitor" })
    .sort({ recordedAt: -1 })
    .lean();

  return records.map((record) => ({
    id: String(record._id),
    firstName: record.visitor?.firstName,
    lastName: record.visitor?.lastName,
    recordedAt: record.recordedAt,
  }));
};

// Liste imprimable des visiteurs d'un service — VOLONTAIREMENT réduite
// au nom et prénom (voir décision produit) : ce document est destiné à
// être partagé/affiché, pas à circuler avec des coordonnées
// personnelles.
// Date/heure du service à afficher dans l'export — la date d'ACTIVATION
// effective (premier scan d'agent, voir presenceQrWindow.js), pas la
// date de création du QR : c'est elle qui correspond au moment réel où
// le service a eu lieu, y compris pour un QR généré à l'avance et
// resté "en attente" plusieurs jours avant le culte.
const formatEventDateTime = (securityQr) => {
  const { validFrom } = getEffectiveWindow(securityQr);

  if (!validFrom) return "Service pas encore démarré";

  return validFrom.toLocaleString("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
  });
};

export const buildVisitorsPdf = async (securityQr) => {
  const visitors = await listVisitors(securityQr._id);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.image(LOGO_PATH, { width: 56, align: "center" });
    doc.moveDown(0.4);

    doc
      .fontSize(15)
      .fillColor("#0d5b3e")
      .text("Centre Apostolique Vie et Abondance", { align: "center" });

    doc
      .fontSize(11)
      .fillColor("#1f2a25")
      .text(`Visiteurs — ${securityQr.label}`, { align: "center" });

    doc
      .fontSize(9)
      .fillColor("#5a6862")
      .text(formatEventDateTime(securityQr), { align: "center" })
      .moveDown(0.8);

    if (visitors.length === 0) {
      doc.fontSize(10).text("Aucun visiteur enregistré pour ce service.", { align: "center" });
    } else {
      visitors.forEach((visitor, index) => {
        doc
          .fontSize(11)
          .fillColor("#1f2a25")
          .text(`${index + 1}. ${visitor.lastName} ${visitor.firstName}`);
      });
    }

    doc.end();
  });
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
