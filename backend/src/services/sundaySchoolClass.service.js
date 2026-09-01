import SundaySchoolClass from "../models/SundaySchoolClass.js";
import Child from "../models/Child.js";
import MonitorAssignment from "../models/MonitorAssignment.js";
import { ApiError } from "../utils/ApiError.js";

// Classes de l'École du dimanche.
//
// Rien n'est codé en dur : ni le nombre de classes, ni leurs noms, ni
// leurs tranches d'âge. L'assemblée en compte trois aujourd'hui
// (03-05, 06-08, 09-12) ; elle doit pouvoir en ouvrir une quatrième
// sans développeur.

// Effectifs et encadrement, en DEUX requêtes groupées quelle que soit
// le nombre de classes — et non une paire de requêtes par classe.
// C'est le N+1 classique : invisible sur quatre classes, il le
// resterait longtemps, et c'est précisément pour ça qu'il faut
// l'éviter tout de suite.
const attachCounts = async (classes) => {
  const ids = classes.map((item) => item._id);

  const [childCounts, monitors] = await Promise.all([
    Child.aggregate([
      { $match: { currentClass: { $in: ids }, status: "actif" } },
      { $group: { _id: "$currentClass", count: { $sum: 1 } } },
    ]),
    MonitorAssignment.find({ primaryClass: { $in: ids }, status: "active" })
      .populate("member", "firstName lastName photo registrationNumber")
      .lean(),
  ]);

  const countByClass = new Map(
    childCounts.map((row) => [String(row._id), row.count])
  );

  const monitorsByClass = new Map();

  for (const assignment of monitors) {
    const key = String(assignment.primaryClass);

    if (!monitorsByClass.has(key)) monitorsByClass.set(key, []);

    monitorsByClass.get(key).push({
      id: String(assignment._id),
      level: assignment.level,
      member: assignment.member,
    });
  }

  return classes.map((item) => ({
    ...item,
    id: String(item._id),
    childCount: countByClass.get(String(item._id)) ?? 0,
    monitors: monitorsByClass.get(String(item._id)) ?? [],
  }));
};

export const list = async ({ church, status, search } = {}) => {
  const filter = {};

  if (church) filter.church = church;
  if (status) filter.status = status;

  if (search) {
    const safe = String(search).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    filter.name = { $regex: safe, $options: "i" };
  }

  const classes = await SundaySchoolClass.find(filter)
    .populate("leader", "firstName lastName photo")
    .sort({ church: 1, ageMin: 1, name: 1 })
    .lean();

  return attachCounts(classes);
};

export const getById = async (id) => {
  const item = await SundaySchoolClass.findById(id)
    .populate("leader", "firstName lastName photo registrationNumber")
    .lean();

  if (!item) throw ApiError.notFound("Classe introuvable.");

  const [withCounts] = await attachCounts([item]);

  return withCounts;
};

export const create = async (payload, user) => {
  try {
    const document = await SundaySchoolClass.create({
      ...payload,
      createdBy: user?.id,
    });

    return document.toJSON();
  } catch (error) {
    if (error.code === 11000) {
      throw ApiError.conflict(
        "Une classe porte déjà ce nom dans cette église. Deux classes homonymes seraient indiscernables dans les listes d'appel."
      );
    }

    throw error;
  }
};

export const update = async (id, payload) => {
  try {
    const document = await SundaySchoolClass.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    if (!document) throw ApiError.notFound("Classe introuvable.");

    return document.toJSON();
  } catch (error) {
    if (error.code === 11000) {
      throw ApiError.conflict("Une classe porte déjà ce nom dans cette église.");
    }

    throw error;
  }
};

// ARCHIVAGE, jamais suppression.
//
// Une classe supprimée laisserait ses séances, ses présences et ses
// affectations rattachées à un identifiant qui ne désigne plus rien —
// l'historique de présence des enfants deviendrait illisible. Le
// cahier des charges demande d'ailleurs de « désactiver une classe »,
// pas de l'effacer.
export const archive = async (id) => {
  const item = await SundaySchoolClass.findById(id);

  if (!item) throw ApiError.notFound("Classe introuvable.");

  const remaining = await Child.countDocuments({
    currentClass: id,
    status: "actif",
  });

  if (remaining > 0) {
    throw ApiError.conflict(
      `Cette classe compte encore ${remaining} enfant(s) actif(s). Déplacez-les vers une autre classe avant de l'archiver.`
    );
  }

  item.status = "archived";

  await item.save();

  return item.toJSON();
};

// Classe suggérée pour un âge donné. SUGGESTION, jamais imposition :
// un enfant en avance, en retard, ou qu'on garde avec sa fratrie doit
// rester possible (voir SundaySchoolClass.js).
export const suggestForAge = async (age, { church } = {}) => {
  if (typeof age !== "number") return null;

  const filter = { status: "published" };

  if (church) filter.church = church;

  const classes = await SundaySchoolClass.find(filter).lean();

  return (
    classes.find(
      (item) =>
        typeof item.ageMin === "number" &&
        typeof item.ageMax === "number" &&
        age >= item.ageMin &&
        age <= item.ageMax
    ) ?? null
  );
};
