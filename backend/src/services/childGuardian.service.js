import ChildGuardian from "../models/ChildGuardian.js";
import Child from "../models/Child.js";
import Member from "../models/Member.js";
import { ApiError } from "../utils/ApiError.js";
import { normalizeRegistrationNumber } from "./registrationNumber.service.js";

// Parents et responsables des enfants.
//
// COLLECTION PARTAGÉE, pas un sous-document : le registre réel compte
// sept enfants LIADE, quatre ZADI, trois ADJAFFI. Embarqués dans
// chaque fiche, les mêmes parents auraient été saisis sept fois — sept
// numéros de téléphone à corriger le jour d'un déménagement, et sept
// occasions de diverger.

// Rattache le responsable à sa fiche `Member` quand il est déjà membre
// CAVA, plutôt que de dupliquer son identité.
//
// Le cahier des charges est explicite : « si le parent est déjà un
// membre adulte CAVA, utiliser son profil existant ». On recopie
// néanmoins nom et prénom sur le responsable : ils servent à afficher
// une liste d'enfants sans jointure vers l'annuaire, et un membre
// supprimé ne doit pas rendre la fiche de l'enfant illisible.
const linkToMember = async (payload) => {
  const registrationNumber = normalizeRegistrationNumber(
    payload.memberRegistrationNumber
  );

  if (!registrationNumber) return payload;

  const member = await Member.findOne({ registrationNumber }).lean();

  if (!member) {
    throw ApiError.unprocessable("Aucun membre trouvé avec ce matricule.", {
      memberRegistrationNumber:
        "Vérifiez le matricule, ou laissez-le vide pour un responsable externe.",
    });
  }

  return {
    ...payload,
    member: member._id,
    firstName: payload.firstName || member.firstName,
    lastName: payload.lastName || member.lastName,
    phone: payload.phone || member.phone,
    email: payload.email || member.email,
    church: payload.church ?? member.church,
  };
};

// Nombre d'enfants par responsable, en UNE requête groupée — c'est la
// colonne « Nombre d'enfants » des listes.
const attachChildCounts = async (guardians) => {
  const ids = guardians.map((item) => item._id);

  const rows = await Child.aggregate([
    { $match: { "guardians.guardian": { $in: ids } } },
    { $unwind: "$guardians" },
    { $match: { "guardians.guardian": { $in: ids } } },
    {
      $group: {
        _id: "$guardians.guardian",
        count: { $sum: 1 },
        names: { $push: "$firstName" },
      },
    },
  ]);

  const byGuardian = new Map(rows.map((row) => [String(row._id), row]));

  return guardians.map((item) => {
    const row = byGuardian.get(String(item._id));

    return {
      ...item,
      id: String(item._id),
      childCount: row?.count ?? 0,
      // Prénoms des enfants, pour la ligne « 2 — Samuel, Esther ».
      childNames: row?.names ?? [],
    };
  });
};

export const list = async ({ search, church, page = 1, limit = 20 } = {}) => {
  const filter = {};

  if (church) filter.church = church;

  if (search) {
    const safe = String(search).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = { $regex: safe, $options: "i" };

    filter.$or = [{ firstName: regex }, { lastName: regex }, { phone: regex }];
  }

  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

  const [items, total] = await Promise.all([
    ChildGuardian.find(filter)
      .sort({ lastName: 1, firstName: 1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    ChildGuardian.countDocuments(filter),
  ]);

  return {
    items: await attachChildCounts(items),
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit) || 1,
    },
  };
};

export const getById = async (id) => {
  const guardian = await ChildGuardian.findById(id).lean();

  if (!guardian) throw ApiError.notFound("Responsable introuvable.");

  const [withCounts] = await attachChildCounts([guardian]);

  return withCounts;
};

export const create = async (payload, user) => {
  const data = await linkToMember(payload ?? {});

  try {
    const document = await ChildGuardian.create({ ...data, createdBy: user?.id });

    return document.toJSON();
  } catch (error) {
    if (error.code === 11000) {
      throw ApiError.conflict(
        "Ce membre est déjà enregistré comme responsable. Rattachez l'enfant au responsable existant plutôt que d'en créer un second."
      );
    }

    throw error;
  }
};

export const update = async (id, payload) => {
  const data = await linkToMember(payload ?? {});

  const document = await ChildGuardian.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });

  if (!document) throw ApiError.notFound("Responsable introuvable.");

  return document.toJSON();
};

// SUPPRESSION REFUSÉE tant que le responsable est rattaché à un
// enfant : l'enfant se retrouverait avec un responsable fantôme, et
// c'est précisément l'information dont on a besoin en cas d'urgence.
export const remove = async (id) => {
  const attached = await Child.countDocuments({ "guardians.guardian": id });

  if (attached > 0) {
    throw ApiError.conflict(
      `Ce responsable est rattaché à ${attached} enfant(s). Détachez-le de leurs fiches avant de le supprimer.`
    );
  }

  const document = await ChildGuardian.findByIdAndDelete(id);

  if (!document) throw ApiError.notFound("Responsable introuvable.");

  return true;
};

// Les enfants d'un responsable — la « famille », calculée plutôt que
// stockée. Une entité `Family` avec son propre numéro n'apporterait
// rien de plus tant que le lien parent/enfant suffit à la déduire.
export const childrenOf = async (guardianId) =>
  Child.find({ "guardians.guardian": guardianId })
    .select("fileNumber firstName lastName photo currentClass status")
    .populate("currentClass", "name icon")
    .sort({ lastName: 1, firstName: 1 })
    .lean();
