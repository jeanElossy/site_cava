import QRCode from "qrcode";

import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import PresenceSecurityQr from "../models/PresenceSecurityQr.js";
import PresenceLogin from "../models/PresenceLogin.js";
import {
  signPresenceQrToken,
  verifyPresenceQrToken,
} from "../middlewares/presenceAuth.js";

// Gestion des QR de sécurité du badgeage — génération, vérification,
// révocation, historique d'usage. Voir docs/superpowers/specs/
// 2026-08-04-badgeage-presences-design.md pour la conception complète.

const buildUrl = (token) => `${env.PUBLIC_SITE_URL}/presences?qr=${token}`;

// Statut affiché à l'administration : dérivé de `status` + de la
// fenêtre horaire, jamais stocké — sinon un statut "à venir" resterait
// figé après l'heure de début si personne ne repasse sur l'écran.
export const computeStatus = (qr, now = new Date()) => {
  if (qr.status === "revoked") return "revoked";
  if (now < qr.validFrom) return "upcoming";
  if (now > qr.validUntil) return "expired";
  return "active";
};

const serialize = (qr) => ({
  id: String(qr._id),
  label: qr.label,
  event: qr.event ? String(qr.event) : null,
  validFrom: qr.validFrom,
  validUntil: qr.validUntil,
  status: qr.status,
  computedStatus: computeStatus(qr),
  createdAt: qr.createdAt,
  revokedAt: qr.revokedAt ?? null,
});

export const generate = async ({ label, event, validFrom, validUntil }, user) => {
  const from = new Date(validFrom);
  const until = new Date(validUntil);

  if (!label || typeof label !== "string" || !label.trim()) {
    throw ApiError.badRequest("Le libellé est obligatoire.");
  }

  if (Number.isNaN(from.getTime()) || Number.isNaN(until.getTime())) {
    throw ApiError.badRequest("Dates de validité invalides.");
  }

  if (until <= from) {
    throw ApiError.badRequest(
      "La fin de validité doit être postérieure au début."
    );
  }

  const qr = await PresenceSecurityQr.create({
    label: label.trim(),
    event: event || undefined,
    validFrom: from,
    validUntil: until,
    createdBy: user?.id,
  });

  return serialize(qr);
};

export const listAdmin = async () => {
  const qrs = await PresenceSecurityQr.find({})
    .sort({ validFrom: -1 })
    .lean();

  return qrs.map(serialize);
};

export const getImage = async (id) => {
  const qr = await PresenceSecurityQr.findById(id).lean();

  if (!qr) throw ApiError.notFound("QR de sécurité introuvable.");

  const token = signPresenceQrToken(qr);

  return QRCode.toDataURL(buildUrl(token), {
    width: 900,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#0d5b3e", light: "#ffffff" },
  });
};

export const revoke = async (id, user) => {
  const qr = await PresenceSecurityQr.findById(id);

  if (!qr) throw ApiError.notFound("QR de sécurité introuvable.");

  if (qr.status !== "revoked") {
    qr.status = "revoked";
    qr.revokedAt = new Date();
    qr.revokedBy = user?.id;
    await qr.save();
  }

  return serialize(qr);
};

export const history = async (id) => {
  const qr = await PresenceSecurityQr.findById(id).lean();

  if (!qr) throw ApiError.notFound("QR de sécurité introuvable.");

  const logins = await PresenceLogin.find({ securityQr: id })
    .sort({ loggedInAt: -1 })
    .populate("agent", "firstName lastName registrationNumber role")
    .lean();

  return logins.map((login) => ({
    id: String(login._id),
    loggedInAt: login.loggedInAt,
    ip: login.ip,
    agent: login.agent
      ? {
          firstName: login.agent.firstName,
          lastName: login.agent.lastName,
          registrationNumber: login.agent.registrationNumber,
          role: login.agent.role,
        }
      : null,
  }));
};

// Vérifie un jeton `presence_qr` : signature PUIS autorité en base sur
// le statut et la fenêtre horaire (voir presenceAuth.js — le jeton ne
// porte lui-même aucune de ces deux informations). Utilisé à la fois
// par la route publique `qr/verify` et par `presence.service.js#agentLogin`,
// qui ne fait jamais confiance à une vérification déjà faite côté
// client.
export const verifyToken = async (token) => {
  const payload = verifyPresenceQrToken(token);

  if (!payload) {
    return { ok: false, reason: "invalide" };
  }

  const qr = await PresenceSecurityQr.findOne({ jti: payload.jti });

  if (!qr) {
    return { ok: false, reason: "invalide" };
  }

  if (qr.status === "revoked") {
    return { ok: false, reason: "revoque", qr };
  }

  const now = new Date();

  if (now < qr.validFrom) {
    return { ok: false, reason: "pas_encore_valide", qr };
  }

  if (now > qr.validUntil) {
    return { ok: false, reason: "expire", qr };
  }

  return { ok: true, qr };
};

export const REASON_MESSAGES = {
  invalide: "QR de sécurité invalide.",
  revoque: "Ce QR de sécurité a été révoqué.",
  pas_encore_valide: "Ce QR de sécurité n'est pas encore valide.",
  expire: "Ce QR de sécurité a expiré.",
};
