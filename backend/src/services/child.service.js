import Child from "../models/Child.js";
import ChildGuardian from "../models/ChildGuardian.js";
import ChildAttendance from "../models/ChildAttendance.js";
import SundaySchoolClass from "../models/SundaySchoolClass.js";
import { ApiError } from "../utils/ApiError.js";
import { asString } from "../middlewares/sanitize.js";
import {
  nextChildFileNumber,
  advancePastManualChildNumber,
} from "./childNumber.service.js";
import { childFileNumberOf, normalizeChildFileNumber } from "../utils/childFileNumber.js";

// Dossiers des enfants.

const MAX_LIMIT = 100;

// Champs qu'une requête ne peut jamais écrire, même si le client les
// envoie. `fileNumber` en tête : il est attribué par le compteur
// atomique, pas choisi. Même liste d'esprit que `PROTECTED_FIELDS`
// dans crud.service.js.
const PROTECTED_FIELDS = [
  "_id",
  "id",
  "fileNumber",
  "createdAt",
  "updatedAt",
  "createdBy",
  "source",
  "__v",
];

const strip = (payload = {}) => {
  const clean = { ...payload };

  for (const field of PROTECTED_FIELDS) delete clean[field];

  return clean;
};

// Une CRÉATION MANUELLE exige ce que le formulaire affiche comme
// obligatoire. Le schéma, lui, reste permissif — il doit accepter les
// fiches reprises du registre papier, qui ne portent que des noms
// (voir Child.js). La règle stricte vit donc ici, sur le seul chemin
// où l'information est réellement disponible.
const assertCreatable = (payload) => {
  const missing = [];

  if (!payload.firstName) missing.push("firstName");
  if (!payload.lastName) missing.push("lastName");
  if (!payload.dateOfBirth) missing.push("dateOfBirth");
  if (!payload.gender) missing.push("gender");

  if (missing.length > 0) {
    throw ApiError.unprocessable("Des informations obligatoires manquent.", {
      ...(missing.includes("firstName") ? { firstName: "Le prénom est obligatoire." } : {}),
      ...(missing.includes("lastName") ? { lastName: "Le nom est obligatoire." } : {}),
      ...(missing.includes("dateOfBirth")
        ? { dateOfBirth: "La date de naissance est obligatoire." }
        : {}),
      ...(missing.includes("gender") ? { gender: "Le sexe est obligatoire." } : {}),
    });
  }
};

export const list = async ({
  page = 1,
  limit = 20,
  search,
  classId,
  church,
  status,
  gender,
  ageMin,
  ageMax,
  guardianId,
  incompleteOnly,
} = {}) => {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), MAX_LIMIT);

  const filter = {};

  if (church) filter.church = Number(church);
  if (classId) filter.currentClass = classId;
  if (status) filter.status = asString(status, 20);
  if (gender) filter.gender = asString(gender, 20);
  if (guardianId) filter["guardians.guardian"] = guardianId;

  // Filtre par âge : traduit en fenêtre de DATES DE NAISSANCE, parce
  // que l'âge n'est pas stocké (il serait faux dès le lendemain d'un
  // anniversaire — voir Child.js). Les bornes sont inversées : l'enfant
  // le plus jeune est celui né le plus récemment.
  if (ageMin !== undefined || ageMax !== undefined) {
    const now = new Date();
    const range = {};

    if (ageMax !== undefined) {
      const oldest = new Date(now);
      oldest.setUTCFullYear(oldest.getUTCFullYear() - Number(ageMax) - 1);
      range.$gt = oldest;
    }

    if (ageMin !== undefined) {
      const youngest = new Date(now);
      youngest.setUTCFullYear(youngest.getUTCFullYear() - Number(ageMin));
      range.$lte = youngest;
    }

    filter.dateOfBirth = range;
  }

  // Dossiers repris du registre papier, encore à compléter.
  if (incompleteOnly) {
    filter.$or = [
      { dateOfBirth: { $exists: false } },
      { gender: { $exists: false } },
      { currentClass: { $exists: false } },
    ];
  }

  const needle = asString(search, 80);

  if (needle) {
    // Un numéro de dossier collé depuis une liste est reconnu tel quel,
    // même mal recopié (« cava enf 124 ») — voir
    // normalizeChildFileNumber. Sans ça, la recherche la plus naturelle
    // ne renverrait rien.
    const asFileNumber = normalizeChildFileNumber(needle);

    if (asFileNumber) {
      filter.fileNumber = asFileNumber;
    } else {
      const safe = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = { $regex: safe, $options: "i" };

      // `$and` plutôt qu'un second `$or` : `incompleteOnly` en pose
      // déjà un, et deux clés `$or` dans le même objet s'écrasent —
      // le filtre « à compléter » disparaîtrait en silence dès qu'on
      // taperait dans la recherche.
      const searchClause = { $or: [{ firstName: regex }, { lastName: regex }] };

      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, searchClause];
        delete filter.$or;
      } else {
        Object.assign(filter, searchClause);
      }
    }
  }

  const [items, total] = await Promise.all([
    Child.find(filter)
      .populate("currentClass", "name icon room")
      .sort({ lastName: 1, firstName: 1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean({ virtuals: true }),
    Child.countDocuments(filter),
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

// Fiche complète — SANS l'historique de présence ni les documents.
//
// Le cahier des charges le demande explicitement : « ne pas charger
// tout l'historique à chaque ouverture du profil ». Ces deux blocs ont
// leurs propres routes paginées.
export const getById = async (id) => {
  const child = await Child.findById(id)
    .populate("currentClass", "name icon room church usualDay usualStartTime usualEndTime")
    .populate("guardians.guardian")
    .lean({ virtuals: true });

  if (!child) throw ApiError.notFound("Enfant introuvable.");

  return child;
};

export const create = async (payload, user) => {
  const data = strip(payload ?? {});

  assertCreatable(data);

  // Le numéro n'est réservé qu'APRÈS validation : le réserver avant
  // consommerait un numéro à chaque formulaire mal rempli, et la
  // séquence afficherait des trous inexpliqués.
  const { fileNumber } = await nextChildFileNumber();

  const child = await Child.create({
    ...data,
    fileNumber,
    createdBy: user?.id,
    ...(data.currentClass ? { classAssignedAt: new Date() } : {}),
  });

  return child.toJSON();
};

export const update = async (id, payload) => {
  const data = strip(payload ?? {});

  const child = await Child.findById(id);

  if (!child) throw ApiError.notFound("Enfant introuvable.");

  // Un changement de classe horodate l'affectation : c'est la « date
  // d'affectation » affichée sur la fiche, et elle n'aurait aucun sens
  // si elle restait celle de l'inscription.
  if (
    data.currentClass !== undefined &&
    String(data.currentClass ?? "") !== String(child.currentClass ?? "")
  ) {
    data.classAssignedAt = data.currentClass ? new Date() : undefined;
  }

  Object.assign(child, data);

  await child.save();

  return child.toJSON();
};

// Affectation à une classe — opération à part, parce qu'elle est
// tracée et qu'elle a ses propres règles.
export const assignClass = async (id, classId) => {
  const child = await Child.findById(id);

  if (!child) throw ApiError.notFound("Enfant introuvable.");

  if (!classId) {
    child.currentClass = undefined;
    child.classAssignedAt = undefined;

    await child.save();

    return child.toJSON();
  }

  const target = await SundaySchoolClass.findById(classId).lean();

  if (!target || target.status === "archived") {
    throw ApiError.unprocessable("Classe introuvable ou archivée.", {
      classId: "Choisissez une classe active.",
    });
  }

  // La tranche d'âge ne BLOQUE pas — elle avertit. Un enfant en avance,
  // en retard, ou qu'on garde avec sa fratrie doit rester possible
  // (voir SundaySchoolClass.js). Refuser ici obligerait à contourner
  // l'outil dès le premier cas réel.
  const age = child.age;

  const warning =
    typeof age === "number" &&
    typeof target.ageMin === "number" &&
    typeof target.ageMax === "number" &&
    (age < target.ageMin || age > target.ageMax)
      ? `${child.firstName} a ${age} ans, hors de la tranche ${target.ageMin}–${target.ageMax} ans de cette classe.`
      : null;

  child.currentClass = target._id;
  child.classAssignedAt = new Date();
  child.church = target.church;

  await child.save();

  return { child: child.toJSON(), warning };
};

// DÉSACTIVATION, jamais suppression : les présences déjà enregistrées
// référencent l'enfant, et un dossier effacé rendrait illisible
// l'historique d'une classe entière.
export const setStatus = async (id, status) => {
  if (!["actif", "inactif"].includes(status)) {
    throw ApiError.badRequest("Statut invalide.");
  }

  const child = await Child.findByIdAndUpdate(
    id,
    { status },
    { new: true, runValidators: true }
  );

  if (!child) throw ApiError.notFound("Enfant introuvable.");

  return child.toJSON();
};

// Responsables — ajout, retrait, mise à jour du lien.
//
// Le lien porte la RELATION (« mère », « tante »), qui appartient au
// couple enfant/responsable : la même personne peut être mère de l'un
// et tante de l'autre.
export const attachGuardian = async (id, { guardianId, relation, isLegalGuardian, canPickUp }) => {
  const [child, guardian] = await Promise.all([
    Child.findById(id),
    ChildGuardian.findById(guardianId).lean(),
  ]);

  if (!child) throw ApiError.notFound("Enfant introuvable.");
  if (!guardian) throw ApiError.notFound("Responsable introuvable.");

  const already = child.guardians.some(
    (item) => String(item.guardian) === String(guardianId)
  );

  if (already) {
    throw ApiError.conflict("Ce responsable est déjà rattaché à cet enfant.");
  }

  child.guardians.push({
    guardian: guardianId,
    relation,
    isLegalGuardian: Boolean(isLegalGuardian),
    canPickUp: canPickUp !== false,
  });

  await child.save();

  return child.toJSON();
};

export const detachGuardian = async (id, guardianId) => {
  const child = await Child.findById(id);

  if (!child) throw ApiError.notFound("Enfant introuvable.");

  child.guardians = child.guardians.filter(
    (item) => String(item.guardian) !== String(guardianId)
  );

  await child.save();

  return child.toJSON();
};

// Historique de présence — PAGINÉ, jamais complet.
export const attendanceHistory = async (id, { page = 1, limit = 20 } = {}) => {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), MAX_LIMIT);

  const [items, total, tally] = await Promise.all([
    ChildAttendance.find({ child: id })
      .populate("session", "title type date startTime")
      .populate("class", "name icon")
      .populate("recordedBy", "firstName lastName")
      .populate({
        path: "substitution",
        select: "replacedMonitor",
        populate: { path: "replacedMonitor", select: "firstName lastName" },
      })
      .sort({ date: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    ChildAttendance.countDocuments({ child: id }),
    // Totaux calculés sur TOUT l'historique, pas sur la page affichée :
    // un taux de présence qui changerait en tournant la page serait
    // pire qu'absent.
    ChildAttendance.aggregate([
      { $match: { child: (await Child.findById(id).select("_id").lean())?._id } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  const counts = { present: 0, absent: 0, excuse: 0 };

  for (const row of tally) counts[row._id] = row.count;

  const total_ = counts.present + counts.absent + counts.excuse;

  return {
    items,
    stats: {
      ...counts,
      total: total_,
      // Les absences excusées comptent comme des absences dans le taux :
      // le taux mesure la présence réelle en salle, pas la légitimité
      // des absences.
      rate: total_ > 0 ? Math.round((counts.present / total_) * 100) : null,
    },
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit) || 1,
    },
  };
};

// Reprise du registre papier — voir scripts/seed-children-registry.js.
//
// Passe par le compteur comme une création ordinaire, puis le fait
// avancer si un numéro a été imposé : sans ça, le prochain enfant
// enregistré recevrait un numéro déjà attribué.
export const importFromRegistry = async ({ fileNumber, ...payload }) => {
  const imposed = fileNumber ? childFileNumberOf(fileNumber) : null;

  const number = imposed
    ? { fileNumber: normalizeChildFileNumber(fileNumber) }
    : await nextChildFileNumber();

  const child = await Child.create({
    ...payload,
    fileNumber: number.fileNumber,
    source: "registre",
  });

  if (imposed) await advancePastManualChildNumber(imposed);

  return child.toJSON();
};
