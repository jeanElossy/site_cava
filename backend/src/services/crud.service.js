import { ApiError } from "../utils/ApiError.js";
import { asString } from "../middlewares/sanitize.js";

// Fabrique de service CRUD.
//
// Les 5 ressources de contenu partagent exactement la même logique.
// La factoriser évite cinq copies qui divergeraient au premier
// correctif — notamment sur le filtre de publication, qu'il serait
// facile d'oublier dans l'une d'elles.

const MAX_LIMIT = 100;

// Champs jamais modifiables depuis une requête, même si le client les
// envoie. Sans cette liste, un `PATCH` pourrait réécrire l'auteur ou
// les horodatages.
const PROTECTED_FIELDS = [
  "_id",
  "id",
  "createdAt",
  "updatedAt",
  "createdBy",
  "__v",
];

const strip = (payload = {}) => {
  const clean = { ...payload };

  for (const field of PROTECTED_FIELDS) delete clean[field];

  return clean;
};

export const createCrudService = (
  Model,
  {
    label = "Ressource",
    // Tri par défaut des listes d'administration.
    defaultSort = { createdAt: -1 },
    // Filtre appliqué aux lectures PUBLIQUES. C'est ici que se joue
    // la règle « le public ne voit que le contenu publié ».
    publicFilter = { status: "published" },
    publicSort = defaultSort,
    // Champs interrogeables en recherche texte.
    searchableFields = ["title"],
  } = {}
) => {
  const buildSearch = (search) => {
    if (!search) return {};

    const safe = String(search)
      .slice(0, 80)
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    return {
      $or: searchableFields.map((field) => ({
        [field]: { $regex: safe, $options: "i" },
      })),
    };
  };

  return {
    // ---- Lecture publique -------------------------------------
    listPublic: async ({ filter = {}, limit } = {}) => {
      // `publicFilter` est appliqué EN DERNIER, volontairement : ainsi
      // aucun paramètre de requête ne peut écraser la contrainte
      // « seulement le contenu publié », même si un filtre portant le
      // même nom était autorisé par erreur.
      const query = Model.find({
        ...filter,
        ...publicFilter,
      })
        .sort(publicSort)
        .lean();

      if (limit) {
        query.limit(Math.min(Number(limit) || 0, MAX_LIMIT));
      }

      return query;
    },

    getPublicBySlug: async (slug) => {
      const doc = await Model.findOne({
        slug,
        ...publicFilter,
      }).lean();

      if (!doc) {
        throw ApiError.notFound(`${label} introuvable.`);
      }

      return doc;
    },

    // ---- Administration ---------------------------------------
    listAdmin: async ({
      page = 1,
      limit = 20,
      status,
      search,
      filter = {},
    } = {}) => {
      const safePage = Math.max(Number(page) || 1, 1);
      const safeLimit = Math.min(
        Math.max(Number(limit) || 20, 1),
        MAX_LIMIT
      );

      // `asString` : sans lui, `?status[$ne]=x` injecterait un
      // opérateur MongoDB et inverserait le filtre.
      const safeStatus = asString(status, 20);

      const criteria = {
        ...filter,
        ...(safeStatus ? { status: safeStatus } : {}),
        ...buildSearch(asString(search, 80)),
      };

      const [items, total] = await Promise.all([
        Model.find(criteria)
          .sort(defaultSort)
          .skip((safePage - 1) * safeLimit)
          .limit(safeLimit)
          .lean(),
        Model.countDocuments(criteria),
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
    },

    getById: async (id) => {
      const doc = await Model.findById(id).lean();

      if (!doc) {
        throw ApiError.notFound(`${label} introuvable.`);
      }

      return doc;
    },

    create: async (payload, user) => {
      const doc = await Model.create({
        ...strip(payload),
        ...(user ? { createdBy: user.id } : {}),
      });

      return doc.toJSON();
    },

    update: async (id, payload) => {
      const doc = await Model.findByIdAndUpdate(
        id,
        strip(payload),
        { new: true, runValidators: true }
      );

      if (!doc) {
        throw ApiError.notFound(`${label} introuvable.`);
      }

      return doc.toJSON();
    },

    remove: async (id) => {
      const doc = await Model.findByIdAndDelete(id);

      if (!doc) {
        throw ApiError.notFound(`${label} introuvable.`);
      }

      return true;
    },
  };
};
