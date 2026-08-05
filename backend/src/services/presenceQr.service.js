import QRCode from "qrcode";

import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import PresenceSecurityQr from "../models/PresenceSecurityQr.js";
import PresenceLogin from "../models/PresenceLogin.js";
import { getEffectiveWindow } from "../utils/presenceQrWindow.js";
import {
  signPresenceQrToken,
  verifyPresenceQrToken,
} from "../middlewares/presenceAuth.js";

// Gestion des QR de sécurité du badgeage — génération, vérification,
// révocation, historique d'usage. Voir docs/superpowers/specs/
// 2026-08-04-badgeage-presences-design.md pour la conception complète.

const buildUrl = (token) => `${env.PUBLIC_SITE_URL}/presences?qr=${token}`;

// Statut affiché à l'administration : dérivé de `status` + de l'état
// d'activation + de la fenêtre effective, jamais stocké — sinon un
// statut figerait dès qu'on cesse de repasser sur l'écran.
export const computeStatus = (qr, now = new Date()) => {
  if (qr.status === "revoked") return "revoked";
  if (!qr.activatedAt) return "pending";

  const { validUntil } = getEffectiveWindow(qr);

  return now > validUntil ? "expired" : "active";
};

const serialize = (qr) => {
  const { validFrom, validUntil } = getEffectiveWindow(qr);

  return {
    id: String(qr._id),
    label: qr.label,
    event: qr.event ? String(qr.event) : null,
    durationMinutes: qr.durationMinutes,
    notBefore: qr.notBefore ?? null,
    activatedAt: qr.activatedAt ?? null,
    validFrom,
    validUntil,
    status: qr.status,
    computedStatus: computeStatus(qr),
    createdAt: qr.createdAt,
    revokedAt: qr.revokedAt ?? null,
  };
};

export const generate = async (
  { label, event, durationMinutes, notBefore },
  user
) => {
  if (!label || typeof label !== "string" || !label.trim()) {
    throw ApiError.badRequest("Le libellé est obligatoire.");
  }

  const duration = Number(durationMinutes);

  if (!Number.isFinite(duration) || duration <= 0) {
    throw ApiError.badRequest(
      "La durée de validité doit être un nombre de minutes positif."
    );
  }

  let notBeforeDate;

  if (notBefore) {
    notBeforeDate = new Date(notBefore);

    if (Number.isNaN(notBeforeDate.getTime())) {
      throw ApiError.badRequest("Date d'activation minimale invalide.");
    }
  }

  const qr = await PresenceSecurityQr.create({
    label: label.trim(),
    event: event || undefined,
    durationMinutes: duration,
    notBefore: notBeforeDate,
    createdBy: user?.id,
  });

  return serialize(qr);
};

export const listAdmin = async () => {
  const qrs = await PresenceSecurityQr.find({})
    .sort({ createdAt: -1 })
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
//
// C'EST ICI QUE L'ACTIVATION A LIEU : si le QR n'a encore jamais été
// scanné avec succès (`activatedAt` vide), ce tout premier scan pose
// `activatedAt = maintenant` — la fenêtre de validité (voir
// utils/presenceQrWindow.js) ne démarre qu'à cet instant, jamais à la
// création du QR. `findOneAndUpdate` conditionné sur `activatedAt:
// null` rend cette écriture atomique : si deux scans arrivent au même
// instant (deux agents, ou un double-scan), un seul gagne la course et
// pose la date — l'autre relit simplement la valeur déjà posée.
export const verifyToken = async (token) => {
  const payload = verifyPresenceQrToken(token);

  if (!payload) {
    return { ok: false, reason: "invalide" };
  }

  let qr = await PresenceSecurityQr.findOne({ jti: payload.jti });

  if (!qr) {
    return { ok: false, reason: "invalide" };
  }

  if (qr.status === "revoked") {
    return { ok: false, reason: "revoque", qr };
  }

  const now = new Date();

  if (qr.notBefore && now < qr.notBefore) {
    return { ok: false, reason: "pas_encore_valide", qr };
  }

  if (!qr.activatedAt) {
    qr =
      (await PresenceSecurityQr.findOneAndUpdate(
        { _id: qr._id, activatedAt: null },
        { activatedAt: now },
        { new: true }
      )) ?? (await PresenceSecurityQr.findById(qr._id));
  }

  const { validUntil } = getEffectiveWindow(qr);

  if (now > validUntil) {
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
