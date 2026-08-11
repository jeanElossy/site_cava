import mongoose from "mongoose";

import SocialAid from "../models/SocialAid.js";
import SocialAidType from "../models/SocialAidType.js";
import SocialLedgerEntry from "../models/SocialLedgerEntry.js";
import SocialCounter from "../models/SocialCounter.js";
import Member from "../models/Member.js";

import { ApiError } from "../utils/ApiError.js";
import { normalizeRegistrationNumber } from "./registrationNumber.service.js";
import { computeCashBalance } from "./socialContribution.service.js";

// Logique métier des aides sociales (décaissements de la caisse du
// Service Social) — Phase 2. Voir
// docs/superpowers/specs/2026-08-11-service-social-phase2-design.md.
//
// Même absence de transaction Mongo qu'en Phase 1 (voir l'en-tête de
// socialContribution.service.js) : la validation/le refus/l'annulation
// s'appuient sur `findOneAndUpdate` filtré sur l'état lu juste avant
// (verrou optimiste), pas sur une session.

const asString = (value, max = 200) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isChurch = (value) =>
  Number.isInteger(value) && value >= 1 && value <= 5;

const STATUS_LABELS = {
  en_attente: "en attente",
  payee: "payée",
  refusee: "refusée",
  annulee: "annulée",
};

const AID_STATUS_VALUES = ["en_attente", "payee", "refusee", "annulee"];

// ------------------------------------------------------------------
// RÉFÉRENCE AIDE-YYYY-NNNNN
// ------------------------------------------------------------------
// Même compteur atomique que SocialCounter (nextSocialReference dans
// socialContribution.service.js), une clé différente ("social-aide")
// pour un compteur indépendant — voir SocialCounter.js.
const nextAidReference = async () => {
  const counter = await SocialCounter.findOneAndUpdate(
    { key: "social-aide" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const year = new Date().getUTCFullYear();

  return `AIDE-${year}-${String(counter.seq).padStart(5, "0")}`;
};

// ------------------------------------------------------------------
// TYPES D'AIDE (CRUD à la main — voir social.routes.js)
// ------------------------------------------------------------------

export const getAidTypes = async () =>
  SocialAidType.find().sort({ order: 1, name: 1 }).lean();

export const createAidType = async (
  { name, description, active, order } = {},
  user
) => {
  const trimmedName = asString(name, 60);

  if (!trimmedName) {
    throw ApiError.unprocessable("Le nom du type d'aide est obligatoire.", {
      name: "Indiquez un nom.",
    });
  }

  const doc = await SocialAidType.create({
    name: trimmedName,
    description: asString(description, 240),
    active: active === undefined ? true : Boolean(active),
    order: Number.isFinite(Number(order)) ? Number(order) : 0,
    createdBy: user?.id,
  });

  return doc.toObject();
};

export const updateAidType = async (
  id,
  { name, description, active, order } = {}
) => {
  if (!mongoose.isValidObjectId(id)) {
    throw ApiError.notFound("Type d'aide introuvable.");
  }

  const update = {};

  if (name !== undefined) {
    const trimmedName = asString(name, 60);

    if (!trimmedName) {
      throw ApiError.unprocessable("Le nom du type d'aide est obligatoire.", {
        name: "Indiquez un nom.",
      });
    }

    update.name = trimmedName;
  }

  if (description !== undefined) update.description = asString(description, 240);
  if (active !== undefined) update.active = Boolean(active);
  if (order !== undefined) update.order = Number(order) || 0;

  const doc = await SocialAidType.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
  });

  if (!doc) throw ApiError.notFound("Type d'aide introuvable.");

  return doc.toObject();
};

export const removeAidType = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw ApiError.notFound("Type d'aide introuvable.");
  }

  const doc = await SocialAidType.findByIdAndDelete(id);

  if (!doc) throw ApiError.notFound("Type d'aide introuvable.");

  return true;
};

// ------------------------------------------------------------------
// CRÉATION D'UNE DEMANDE
// ------------------------------------------------------------------

export const createAid = async (
  { memberId, aidTypeId, amount, motif, description, proofUrl } = {},
  user
) => {
  if (!mongoose.isValidObjectId(memberId)) {
    throw ApiError.notFound("Membre introuvable.");
  }

  const member = await Member.findById(memberId).lean();

  if (!member) throw ApiError.notFound("Membre introuvable.");

  if (!isChurch(member.church)) {
    throw ApiError.unprocessable(
      "Ce membre n'est rattaché à aucune église, impossible de créer une aide.",
      { memberId: "Rattachez d'abord ce membre à une église (1 à 5)." }
    );
  }

  // La forme de l'identifiant est vérifiée AVANT la requête, et pas
  // seulement par l'absence de résultat : Mongoose retire d'un filtre
  // les clés dont la valeur est `undefined`. Un corps de requête sans
  // `aidTypeId` transformerait donc `findOne({ _id: undefined, active:
  // true })` en `findOne({ active: true })` — c'est-à-dire le PREMIER
  // type actif venu, silencieusement affecté à l'aide. Même piège que
  // donation.service.js#createDonation.
  if (!mongoose.isValidObjectId(aidTypeId)) {
    throw ApiError.unprocessable("Type d'aide invalide.", {
      aidTypeId: "Choisissez un type d'aide proposé.",
    });
  }

  const aidType = await SocialAidType.findOne({ _id: aidTypeId, active: true });

  if (!aidType) {
    throw ApiError.unprocessable("Type d'aide invalide.", {
      aidTypeId: "Choisissez un type d'aide proposé.",
    });
  }

  const amountNumber = Number(amount);

  if (!Number.isInteger(amountNumber) || amountNumber <= 0) {
    throw ApiError.unprocessable("Montant invalide.", {
      amount: "Indiquez un montant entier positif.",
    });
  }

  const trimmedMotif = asString(motif, 200);

  if (!trimmedMotif) {
    throw ApiError.unprocessable("Le motif est obligatoire.", {
      motif: "Indiquez le motif de la demande.",
    });
  }

  const doc = await SocialAid.create({
    member: memberId,
    church: member.church,
    aidType: { ref: aidType._id, name: aidType.name },
    amount: amountNumber,
    motif: trimmedMotif,
    description: asString(description, 1000),
    proofUrl: typeof proofUrl === "string" ? proofUrl.trim() : "",
    status: "en_attente",
    requestedBy: user.id,
  });

  return doc.toObject();
};

// ------------------------------------------------------------------
// DÉCISION : VALIDATION (= DÉCAISSEMENT IMMÉDIAT)
// ------------------------------------------------------------------

export const validateAid = async (aidId, user) => {
  if (!mongoose.isValidObjectId(aidId)) {
    throw ApiError.notFound("Aide introuvable.");
  }

  const aid = await SocialAid.findById(aidId).populate(
    "member",
    "firstName lastName"
  );

  if (!aid) throw ApiError.notFound("Aide introuvable.");

  if (aid.status !== "en_attente") {
    throw ApiError.conflict(
      `Cette aide est ${STATUS_LABELS[aid.status] ?? aid.status} : seule une aide en attente peut être validée.`
    );
  }

  // Solde ACTUEL de la caisse de l'église du bénéficiaire, recalculé
  // côté serveur — jamais reçu du client. Réutilise la même agrégation
  // que caisse()/dashboard() (voir computeCashBalance dans
  // socialContribution.service.js) : un seul endroit calcule le solde.
  const balance = await computeCashBalance(aid.church);

  if (aid.amount > balance) {
    throw ApiError.conflict(
      `Le montant de l'aide (${aid.amount} F CFA) dépasse le solde disponible de la caisse de cette église (${balance} F CFA).`
    );
  }

  const reference = await nextAidReference();

  // Verrou optimiste : le filtre reprend l'état exactement lu à
  // l'instant, comme socialContribution.service.js#recordPayments. Si
  // une autre décision a eu lieu entretemps, l'update ne matche rien.
  const updated = await SocialAid.findOneAndUpdate(
    { _id: aid._id, status: "en_attente" },
    {
      $set: {
        status: "payee",
        reference,
        decidedBy: user.id,
        decidedAt: new Date(),
        paidAt: new Date(),
      },
    },
    { new: true }
  );

  if (!updated) {
    throw ApiError.conflict("Cette aide a été traitée entretemps.");
  }

  const beneficiary = aid.member
    ? `${aid.member.firstName} ${aid.member.lastName}`
    : "bénéficiaire";

  await SocialLedgerEntry.create({
    church: updated.church,
    type: "aide",
    reference,
    description: `Aide — ${updated.aidType.name} — ${beneficiary}`,
    // Montant NÉGATIF : sortie de caisse.
    amount: -updated.amount,
    recordedBy: user.id,
  });

  const result = updated.toObject();

  // Décision assumée de ne pas bloquer un compte qui crée ET valide sa
  // propre demande (un seul opérateur gère tout le module en pratique
  // actuellement) — mais l'audit doit rester repérable. La route lit
  // ce champ pour journaliser un second événement dédié.
  if (String(aid.requestedBy) === String(user.id)) {
    result.selfApproved = true;
  }

  return result;
};

// ------------------------------------------------------------------
// DÉCISION : REFUS
// ------------------------------------------------------------------

export const refuseAid = async (aidId, { motif } = {}, user) => {
  if (!mongoose.isValidObjectId(aidId)) {
    throw ApiError.notFound("Aide introuvable.");
  }

  const trimmedMotif = asString(motif, 400);

  if (!trimmedMotif) {
    throw ApiError.unprocessable("Le motif de refus est obligatoire.", {
      motif: "Indiquez le motif du refus.",
    });
  }

  const updated = await SocialAid.findOneAndUpdate(
    { _id: aidId, status: "en_attente" },
    {
      $set: {
        status: "refusee",
        decidedBy: user.id,
        decidedAt: new Date(),
        decisionNote: trimmedMotif,
      },
    },
    { new: true }
  );

  if (!updated) {
    const existing = await SocialAid.findById(aidId).lean();

    if (!existing) throw ApiError.notFound("Aide introuvable.");

    throw ApiError.conflict(
      `Cette aide est ${STATUS_LABELS[existing.status] ?? existing.status} : seule une aide en attente peut être refusée.`
    );
  }

  return updated.toObject();
};

// ------------------------------------------------------------------
// ANNULATION D'UNE AIDE PAYÉE (réservée admin)
// ------------------------------------------------------------------

export const cancelAid = async (aidId, { motif } = {}, user) => {
  if (!mongoose.isValidObjectId(aidId)) {
    throw ApiError.notFound("Aide introuvable.");
  }

  const trimmedMotif = asString(motif, 400);

  if (!trimmedMotif) {
    throw ApiError.unprocessable("Le motif d'annulation est obligatoire.", {
      motif: "Indiquez le motif de l'annulation.",
    });
  }

  const updated = await SocialAid.findOneAndUpdate(
    { _id: aidId, status: "payee" },
    {
      $set: {
        status: "annulee",
        cancelledBy: user.id,
        cancelledAt: new Date(),
        cancelReason: trimmedMotif,
      },
    },
    { new: true }
  );

  if (!updated) {
    const existing = await SocialAid.findById(aidId).lean();

    if (!existing) throw ApiError.notFound("Aide introuvable.");

    throw ApiError.conflict("Seule une aide payée peut être annulée.");
  }

  // L'écriture originale (sortie négative) n'est JAMAIS modifiée ni
  // supprimée — c'est cette écriture de COMPENSATION, positive, qui
  // rétablit le solde. Règle « jamais de suppression d'une opération
  // financière validée » (section 27 du cahier des charges).
  await SocialLedgerEntry.create({
    church: updated.church,
    type: "aide_annulation",
    reference: updated.reference,
    description: `Annulation — ${updated.reference}`,
    amount: updated.amount,
    recordedBy: user.id,
  });

  return updated.toObject();
};

// ------------------------------------------------------------------
// LISTES
// ------------------------------------------------------------------

export const listAids = async ({
  church,
  status,
  search,
  page = 1,
  limit = 20,
} = {}) => {
  const filter = {};

  if (isChurch(Number(church))) filter.church = Number(church);
  if (AID_STATUS_VALUES.includes(status)) filter.status = status;

  const trimmedSearch = asString(search, 80);

  if (trimmedSearch) {
    const safe = escapeRegex(trimmedSearch);
    const normalized = normalizeRegistrationNumber(trimmedSearch);

    const or = [
      { firstName: { $regex: safe, $options: "i" } },
      { lastName: { $regex: safe, $options: "i" } },
    ];

    if (normalized) {
      or.push({
        registrationNumber: { $regex: escapeRegex(normalized), $options: "i" },
      });
    }

    const matchingMembers = await Member.find({ $or: or }).select("_id").lean();

    filter.member = { $in: matchingMembers.map((m) => m._id) };
  }

  const perPage = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const current = Math.max(Number(page) || 1, 1);

  const [items, total] = await Promise.all([
    SocialAid.find(filter)
      .sort({ createdAt: -1 })
      .skip((current - 1) * perPage)
      .limit(perPage)
      .populate("member", "firstName lastName registrationNumber phone")
      .lean(),
    SocialAid.countDocuments(filter),
  ]);

  return { items, total, page: current, perPage };
};

export const getAidById = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw ApiError.notFound("Aide introuvable.");
  }

  const aid = await SocialAid.findById(id)
    .populate("member", "firstName lastName registrationNumber phone church flock")
    .lean();

  if (!aid) throw ApiError.notFound("Aide introuvable.");

  return aid;
};
