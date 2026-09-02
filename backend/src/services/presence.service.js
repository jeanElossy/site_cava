import { fileURLToPath } from "node:url";
import path from "node:path";

import PDFDocument from "pdfkit";

import Member from "../models/Member.js";
import PresenceLogin from "../models/PresenceLogin.js";
import Attendance from "../models/Attendance.js";
import { ApiError } from "../utils/ApiError.js";
import { normalizeRegistrationNumber } from "./registrationNumber.service.js";
import { getEffectiveWindow } from "../utils/presenceQrWindow.js";
import { drawCenteredImage } from "../utils/pdfLogo.js";
import * as presenceQrService from "./presenceQr.service.js";
import {
  signPresenceSessionToken,
  isPresenceAgent,
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

// `identified` : porte une identité RÉELLE, par opposition à
// l'identité fictive d'un badge invité pré-imprimé ("Invité Homme 1",
// voir recordGuestBadgeAttendance). Un visiteur saisi à la main l'est
// par construction — il n'existe que parce que l'agent a tapé son nom ;
// un badge ne l'est qu'une fois `identifiedAt` posé par
// `identifyVisitor`. Calculé ici plutôt que déduit du prénom côté
// appelant : c'est ce booléen qui décide qui est nommé dans le PDF
// partagé et qui peut ouvrir un dossier SOA.
const serializeVisitor = (attendance) => {
  const visitor = attendance.visitor ?? {};
  const isBadge = Boolean(visitor.badgeCode);

  return {
    id: String(attendance._id),
    firstName: visitor.firstName,
    lastName: visitor.lastName,
    phone: visitor.phone,
    gender: visitor.gender,
    isBadge,
    identified: !isBadge || Boolean(visitor.identifiedAt),
  };
};

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
  if (!(await isPresenceAgent(agent))) {
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
        gender: badge.gender,
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

    // Le visiteur est renvoyé ENTIER (identifiant compris), pas
    // seulement son nom d'affichage : l'écran de scan enchaîne
    // aussitôt sur la saisie de l'identité réelle du porteur du badge
    // (voir identifyVisitor), qui a besoin de l'identifiant de la
    // présence qui vient d'être créée.
    return {
      kind: "visitor",
      visitor: serializeVisitor(attendance),
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

const VISITOR_GENDERS = ["homme", "femme"];

// Présence d'un VISITEUR sans carte ni dossier `Member` — saisie
// directe par l'agent (nom, prénom, genre, téléphone facultatif).
// Aucune déduplication possible (pas d'identité stable), donc toujours
// `alreadyRecorded: false` : chaque appel crée une nouvelle ligne.
//
// Le genre est exigé ici (pas seulement au niveau du schéma) pour
// renvoyer un message clair à l'agent plutôt qu'une erreur de
// validation Mongoose brute — sert aux totaux femme/homme des exports.
export const markVisitor = async (
  { firstName, lastName, phone, gender },
  presenceAgent,
  presenceQr,
  req
) => {
  const cleanFirstName = String(firstName ?? "").trim();
  const cleanLastName = String(lastName ?? "").trim();
  const cleanGender = String(gender ?? "").trim().toLowerCase();

  if (!cleanFirstName || !cleanLastName) {
    throw ApiError.badRequest("Le prénom et le nom du visiteur sont obligatoires.");
  }

  if (!VISITOR_GENDERS.includes(cleanGender)) {
    throw ApiError.badRequest("Le genre du visiteur est obligatoire (homme ou femme).");
  }

  const attendance = await Attendance.create({
    kind: "visitor",
    visitor: {
      firstName: cleanFirstName,
      lastName: cleanLastName,
      phone: phone ? String(phone).trim() : undefined,
      gender: cleanGender,
    },
    securityQr: presenceQr._id,
    agent: presenceAgent.id,
    method: "manual",
    ip: req?.ip,
    userAgent: req?.headers?.["user-agent"]?.slice(0, 300),
  });

  return {
    visitor: serializeVisitor(attendance),
    alreadyRecorded: false,
    recordedAt: attendance.recordedAt,
  };
};

// Remplace l'identité fictive d'un badge invité pré-imprimé par celle
// de la personne qui le porte — appelé juste après le scan, depuis la
// bulle de confirmation, ou plus tard depuis la liste des visiteurs du
// service.
//
// Restreint au QR de la session : un agent ne peut renseigner que les
// présences du service auquel il est connecté, jamais celles d'un
// autre culte dont il aurait deviné l'identifiant.
//
// Ré-appelable (l'agent corrige une faute de frappe) : la présence
// n'est pas dupliquée, sa seule identité est réécrite — le badge
// physique reste rattaché via `badgeCode`, donc le dédoublonnage par
// l'index unique continue de fonctionner si la même carte repasse
// devant la caméra.
export const identifyVisitor = async (
  { attendanceId, firstName, lastName, phone },
  presenceAgent,
  presenceQr
) => {
  const cleanFirstName = String(firstName ?? "").trim();
  const cleanLastName = String(lastName ?? "").trim();
  const cleanPhone = String(phone ?? "").trim();

  if (!cleanFirstName || !cleanLastName) {
    throw ApiError.badRequest("Le prénom et le nom de l'invité sont obligatoires.");
  }

  const attendance = await Attendance.findOne({
    _id: attendanceId,
    securityQr: presenceQr._id,
    kind: "visitor",
  });

  if (!attendance) {
    throw ApiError.notFound("Visiteur introuvable pour ce service.");
  }

  attendance.visitor.firstName = cleanFirstName;
  attendance.visitor.lastName = cleanLastName;
  attendance.visitor.phone = cleanPhone || undefined;
  attendance.visitor.identifiedAt = new Date();

  await attendance.save();

  return { visitor: serializeVisitor(attendance), recordedAt: attendance.recordedAt };
};

// Visiteurs enregistrés pour LE service en cours (un seul QR) —
// utilisé par l'écran de scan lui-même pour afficher la liste à
// l'agent (export PDF, identification d'un badge, démarrage d'un
// dossier SOA). L'identité de l'agent qui a badgé n'y figure pas, elle
// n'a pas d'usage ici ; le téléphone, si — c'est la coordonnée que
// l'agent vient de saisir et qui part telle quelle dans le dossier SOA
// (voir VisitorsPanel#startSoaDossier), pour ne pas la lui faire
// retaper. Elle ne sort pas pour autant du poste de badgeage : le PDF
// partagé, lui, reste au nom et prénom (buildVisitorsPdf).
//
// `isBadge` distingue un badge invité pré-imprimé d'un visiteur saisi
// à la main ; `identified` dit si la ligne porte une identité RÉELLE
// (voir serializeVisitor). Un badge non identifié n'est qu'un jeton de
// comptage : pas de dossier SOA à ouvrir dessus, et le front propose à
// la place de saisir qui le porte.
export const listVisitors = async (securityQr) => {
  const records = await Attendance.find({ securityQr, kind: "visitor" })
    .sort({ recordedAt: -1 })
    .lean();

  return records.map((record) => ({
    ...serializeVisitor(record),
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
  const women = visitors.filter((visitor) => visitor.gender === "femme").length;
  const men = visitors.filter((visitor) => visitor.gender === "homme").length;

  // Un badge invité pré-imprimé qui n'a pas été identifié ne porte
  // qu'une identité fictive ("Invité Homme 1", voir
  // recordGuestBadgeAttendance) : le nommer ici ne dirait rien à
  // l'équipe des nouvelles âmes qui reçoit ce document. Depuis que
  // l'agent renseigne le porteur du badge juste après le scan (voir
  // identifyVisitor), ces lignes-là ont un vrai nom et rejoignent la
  // liste nominative — d'où le filtre sur `identified` et non plus sur
  // `isBadge`, qui les excluait toutes.
  //
  // Les totaux ci-dessus restent basés sur TOUS les visiteurs, badges
  // non identifiés compris, pour ne pas perdre leur décompte.
  const namedVisitors = visitors.filter((visitor) => visitor.identified);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawCenteredImage(doc, LOGO_PATH, 56);
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
      .moveDown(0.4);

    doc
      .fontSize(10)
      .fillColor("#1f2a25")
      .text(
        `Total visiteurs : ${visitors.length}   —   Femmes : ${women}   —   Hommes : ${men}`,
        { align: "center" }
      )
      .moveDown(0.6);

    if (namedVisitors.length === 0) {
      doc.fontSize(10).text("Aucun visiteur identifié par son nom pour ce service.", { align: "center" });
    } else {
      namedVisitors.forEach((visitor, index) => {
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
