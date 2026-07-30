import MemberSubmission from "../models/MemberSubmission.js";
import Member from "../models/Member.js";
import Flock from "../models/Flock.js";

import { ApiError } from "../utils/ApiError.js";
import {
  normalizeRegistrationNumber,
  parseRegistrationNumber,
  nextRegistrationNumber,
} from "./registrationNumber.service.js";

const MAX_LIMIT = 100;

// Champs que le formulaire public peut proposer. Toute autre clé
// envoyée est ignorée : un client ne doit pas pouvoir glisser
// `status`, `notes` ou tout champ réservé à l'administration dans une
// soumission publique.
const ALLOWED_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "whatsapp",
  "address",
  "church",
  "flock",
  "dateOfBirth",
  "gender",
  "maritalStatus",
  "childrenCount",
  "conversionYear",
  "baptism",
  "previousChurch",
  "profession",
  "skills",
  "desiredDepartment",
  "availability",
  "emergencyContact",
];

const pickAllowed = (payload = {}) =>
  ALLOWED_FIELDS.reduce((accumulator, field) => {
    if (payload[field] !== undefined) accumulator[field] = payload[field];

    return accumulator;
  }, {});

// Compare deux noms sans tenir compte des accents ni de la casse
// ("Liadé" doit correspondre à "liade").
//
// La plage de marques diacritiques combinantes (U+0300 à U+036F) est
// construite à partir des codes numériques plutôt qu'écrite en
// caractères littéraux dans le code source, pour rester lisible et
// insensible à l'encodage de l'éditeur.
const DIACRITICS = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  "g"
);

const stripAccents = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .trim()
    .toLowerCase();

const sameName = (a, b) => stripAccents(a) === stripAccents(b);

// ---- Pré-remplissage public (ancien membre) ------------------------
//
// Le matricule seul ne suffit pas : c'est un identifiant séquentiel,
// donc partiellement devinable (voir registrationNumber.service.js).
// Exiger EN PLUS le nom de famille exact avant de renvoyer quoi que ce
// soit ferme la porte à un simple parcours des ~999 matricules d'une
// église pour collecter des fiches au hasard.
//
// La réponse est volontairement IDENTIQUE (`{ data: null }`) que le
// matricule n'existe pas ou que le nom ne corresponde pas : distinguer
// les deux cas transformerait ce point d'entrée en outil de
// vérification d'existence d'un matricule.
export const lookup = async ({ registrationNumber, lastName }) => {
  const normalized = normalizeRegistrationNumber(registrationNumber);
  const cleanLastName = String(lastName ?? "").trim();

  if (!normalized || !cleanLastName) return { data: null };

  const member = await Member.findOne({
    registrationNumber: normalized,
  }).lean();

  if (!member || !sameName(member.lastName, cleanLastName)) {
    return { data: null };
  }

  return { data: pickAllowed(member) };
};

// ---- Écriture publique -------------------------------------------

export const submit = async ({ type, registrationNumber, data }) => {
  if (!["new", "update"].includes(type)) {
    throw ApiError.badRequest("Type de soumission invalide.");
  }

  const clean = pickAllowed(data);

  if (!clean.firstName?.trim() || !clean.lastName?.trim()) {
    throw ApiError.badRequest(
      "Le prénom et le nom sont obligatoires."
    );
  }

  const submission = { type, data: clean };

  if (type === "update") {
    const normalized = normalizeRegistrationNumber(registrationNumber);

    if (!normalized) {
      throw ApiError.badRequest(
        "Le matricule est obligatoire pour une mise à jour."
      );
    }

    submission.submittedRegistrationNumber = normalized;

    // Recherché côté serveur uniquement : jamais renvoyé à
    // l'appelant, qui ne reçoit qu'un accusé de réception neutre.
    const existing = await Member.findOne({
      registrationNumber: normalized,
    })
      .select("_id")
      .lean();

    if (existing) submission.existingMember = existing._id;
  }

  await MemberSubmission.create(submission);

  return { received: true };
};

// ---- Administration -----------------------------------------------

export const listPending = async ({ page = 1, limit = 20 } = {}) => {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), MAX_LIMIT);

  const filter = { status: "pending" };

  const [items, total] = await Promise.all([
    MemberSubmission.find(filter)
      .sort({ createdAt: 1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    MemberSubmission.countDocuments(filter),
  ]);

  return {
    items,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit) || 1,
    },
  };
};

// Détail d'une soumission, avec la fiche membre actuelle en regard
// pour permettre le comparatif avant/après côté administration.
export const getById = async (id) => {
  const submission = await MemberSubmission.findById(id).lean();

  if (!submission) {
    throw ApiError.notFound("Soumission introuvable.");
  }

  const currentMember = submission.existingMember
    ? await Member.findById(submission.existingMember)
        .populate("flock", "name code")
        .lean()
    : null;

  return { submission, currentMember };
};

const assertFlockBelongsToChurch = async (flockId, church) => {
  const flock = await Flock.findById(flockId).lean();

  if (!flock || flock.church !== Number(church)) {
    throw ApiError.badRequest(
      "La bergerie sélectionnée ne correspond pas à cette église."
    );
  }

  return flock;
};

export const approve = async (id, { overrides = {}, user } = {}) => {
  const submission = await MemberSubmission.findById(id);

  if (!submission) {
    throw ApiError.notFound("Soumission introuvable.");
  }

  if (submission.status !== "pending") {
    throw ApiError.conflict("Cette soumission a déjà été traitée.");
  }

  const data = { ...submission.data, ...pickAllowed(overrides) };

  if (!data.church || !data.flock) {
    throw ApiError.unprocessable(
      "L'église et la bergerie sont obligatoires pour valider."
    );
  }

  const flock = await assertFlockBelongsToChurch(data.flock, data.church);

  let member;

  if (submission.existingMember) {
    member = await Member.findByIdAndUpdate(
      submission.existingMember,
      data,
      { new: true, runValidators: true }
    );

    if (!member) {
      throw ApiError.notFound("Le membre à mettre à jour n'existe plus.");
    }
  } else if (submission.submittedRegistrationNumber) {
    // Matricule papier jamais informatisé : repris tel quel, sans
    // passer par le compteur, qui ne doit générer QUE des matricules
    // neufs. L'année d'arrivée se déduit du matricule lui-même plutôt
    // que de la date du jour.
    const parsed = parseRegistrationNumber(
      submission.submittedRegistrationNumber
    );
    const joinedAt = parsed ? new Date(2000 + parsed.year, 0, 1) : undefined;

    try {
      member = await Member.create({
        ...data,
        registrationNumber: submission.submittedRegistrationNumber,
        ...(joinedAt ? { joinedAt } : {}),
      });
    } catch (error) {
      if (error.code === 11000) {
        throw ApiError.conflict(
          "Ce matricule est déjà attribué à un autre membre."
        );
      }

      throw error;
    }
  } else {
    const currentYear = new Date().getFullYear();
    const { registrationNumber } = await nextRegistrationNumber({
      church: data.church,
      flockCode: flock.code,
      year: currentYear,
    });

    member = await Member.create({ ...data, registrationNumber });
  }

  submission.status = "approved";
  submission.processedBy = user?.id;
  submission.processedAt = new Date();

  await submission.save();

  return { member: member.toJSON(), submission: submission.toJSON() };
};

export const reject = async (id, { reason, user } = {}) => {
  const submission = await MemberSubmission.findById(id);

  if (!submission) {
    throw ApiError.notFound("Soumission introuvable.");
  }

  if (submission.status !== "pending") {
    throw ApiError.conflict("Cette soumission a déjà été traitée.");
  }

  submission.status = "rejected";
  submission.rejectionReason = reason?.trim() || undefined;
  submission.processedBy = user?.id;
  submission.processedAt = new Date();

  await submission.save();

  return submission.toJSON();
};
