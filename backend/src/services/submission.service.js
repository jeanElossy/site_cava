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
  "area",
  "church",
  "flock",
  "dateOfBirth",
  "gender",
  "maritalStatus",
  "childrenCount",
  "conversionYear",
  // Saisie brute (l'année seule) : ce n'est PAS un champ de `Member`,
  // `approve()` la convertit en `joinedAt` (1er janvier de l'année
  // indiquée) avant l'enregistrement.
  "arrivalYear",
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

// Champs renvoyés par le pré-remplissage public — ALLOWED_FIELDS
// privé de `emergencyContact`. Le contact d'urgence est une PERSONNE
// TIERCE (nom + téléphone) qui n'a donné aucun consentement à voir
// ses coordonnées exposées à quiconque devine le matricule et le nom
// du membre. Le membre le ressaisit lui-même si besoin ; ce n'est pas
// le cas des autres champs, qui ne concernent que lui.
const LOOKUP_FIELDS = ALLOWED_FIELDS.filter(
  (field) => field !== "emergencyContact"
);

const pickLookup = (payload = {}) =>
  LOOKUP_FIELDS.reduce((accumulator, field) => {
    if (payload[field] !== undefined) accumulator[field] = payload[field];

    return accumulator;
  }, {});

// Verrou anti-énumération, PAR MATRICULE plutôt que par adresse IP.
//
// La limitation de débit globale (lookupLimiter) borne le coût par IP,
// mais un attaquant qui change d'IP la contourne entièrement — et le
// nom de famille n'est pas toujours secret (certains apparaissent déjà
// publiquement, ex. témoignages, responsables de ministères). Ce
// verrou rend le coût d'une tentative sur UN matricule donné constant,
// quelle que soit la diversité d'IP de l'attaquant : après quelques
// échecs de nom sur ce matricule précis, il se bloque temporairement,
// indépendamment de qui appelle.
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 60 * 1000;

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
// matricule n'existe pas, que le nom ne corresponde pas, ou que le
// matricule soit temporairement verrouillé : distinguer ces cas
// transformerait ce point d'entrée en outil de vérification
// d'existence d'un matricule.
export const lookup = async ({ registrationNumber, lastName }) => {
  const normalized = normalizeRegistrationNumber(registrationNumber);
  const cleanLastName = String(lastName ?? "").trim();

  if (!normalized || !cleanLastName) return { data: null };

  // `lookupFailedAttempts`/`lookupLockedUntil` portent `select: false`
  // sur le schéma (jamais exposés par une route publique) : il faut
  // les redemander explicitement ici, seul endroit qui a besoin de les
  // lire et de les écrire.
  const member = await Member.findOne({
    registrationNumber: normalized,
  }).select("+lookupFailedAttempts +lookupLockedUntil");

  if (!member) return { data: null };

  if (member.lookupLockedUntil && member.lookupLockedUntil > new Date()) {
    return { data: null };
  }

  if (!sameName(member.lastName, cleanLastName)) {
    member.lookupFailedAttempts = (member.lookupFailedAttempts ?? 0) + 1;

    if (member.lookupFailedAttempts >= MAX_FAILED_ATTEMPTS) {
      member.lookupLockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      member.lookupFailedAttempts = 0;
    }

    await member.save();

    return { data: null };
  }

  // Recherche aboutie : un compteur d'échecs laissé en place
  // pénaliserait un membre légitime qui s'est trompé une fois avant de
  // réussir.
  if (member.lookupFailedAttempts) {
    member.lookupFailedAttempts = 0;

    await member.save();
  }

  return { data: pickLookup(member.toObject()) };
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

  // `arrivalYear` (l'année seule, saisie par le membre) n'est pas un
  // champ de `Member` — seul `joinedAt` (une date) l'est. On la retire
  // ici et on la convertit au 1er janvier de l'année indiquée, comme
  // c'était déjà fait pour un matricule papier ci-dessous.
  const { arrivalYear, ...memberData } = data;
  const joinedAtFromYear = arrivalYear
    ? new Date(Number(arrivalYear), 0, 1)
    : undefined;

  let member;

  if (submission.existingMember) {
    member = await Member.findByIdAndUpdate(
      submission.existingMember,
      {
        ...memberData,
        ...(joinedAtFromYear ? { joinedAt: joinedAtFromYear } : {}),
      },
      { new: true, runValidators: true }
    );

    if (!member) {
      throw ApiError.notFound("Le membre à mettre à jour n'existe plus.");
    }
  } else if (submission.submittedRegistrationNumber) {
    // Matricule papier jamais informatisé : repris tel quel, sans
    // passer par le compteur, qui ne doit générer QUE des matricules
    // neufs. L'année d'arrivée se déduit du matricule lui-même — plus
    // fiable qu'une saisie libre pour un membre historique — plutôt
    // que de `arrivalYear`.
    const parsed = parseRegistrationNumber(
      submission.submittedRegistrationNumber
    );
    const joinedAt = parsed
      ? new Date(2000 + parsed.year, 0, 1)
      : joinedAtFromYear;

    try {
      member = await Member.create({
        ...memberData,
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

    member = await Member.create({
      ...memberData,
      registrationNumber,
      ...(joinedAtFromYear ? { joinedAt: joinedAtFromYear } : {}),
    });
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
