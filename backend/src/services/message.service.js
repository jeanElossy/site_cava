import Message from "../models/Message.js";
import { ApiError } from "../utils/ApiError.js";

// Messages des visiteurs.
//
// Ce service ne passe pas par la fabrique CRUD : c'est la seule
// ressource dont l'écriture est PUBLIQUE. Elle mérite ses propres
// règles, explicites et relisibles.

// Liste blanche stricte des champs acceptés du public. Prendre
// `req.body` tel quel laisserait un visiteur poser `status: "archive"`
// ou se rattacher à un ministère arbitraire.
const PUBLIC_FIELDS = [
  "name",
  "email",
  "phone",
  "subject",
  "body",
  "kind",
  "consent",
];

export const submit = async (payload = {}) => {
  const clean = {};

  for (const field of PUBLIC_FIELDS) {
    if (payload[field] !== undefined) {
      clean[field] = payload[field];
    }
  }

  // Le consentement est vérifié ici ET par le modèle. Le doublon est
  // volontaire : c'est une obligation vis-à-vis de la politique de
  // confidentialité, elle ne doit pas dépendre d'une seule couche.
  if (clean.consent !== true) {
    throw ApiError.badRequest(
      "Le consentement est obligatoire pour envoyer un message."
    );
  }

  const doc = await Message.create({
    ...clean,
    status: "nouveau",
    consentAt: new Date(),
  });

  // On ne renvoie pas le document complet au visiteur : il n'a besoin
  // que d'une confirmation, et son message n'a pas à lui revenir
  // enrichi de champs internes.
  return { id: String(doc._id), createdAt: doc.createdAt };
};

export const listAdmin = async ({
  page = 1,
  limit = 20,
  status,
  kind,
} = {}) => {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(
    Math.max(Number(limit) || 20, 1),
    100
  );

  const criteria = {
    ...(status ? { status } : {}),
    ...(kind ? { kind } : {}),
  };

  const [items, total, unread] = await Promise.all([
    Message.find(criteria)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    Message.countDocuments(criteria),
    Message.countDocuments({ status: "nouveau" }),
  ]);

  return {
    items,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      unread,
      pages: Math.ceil(total / safeLimit) || 1,
    },
  };
};

export const getById = async (id) => {
  const doc = await Message.findById(id).lean();

  if (!doc) throw ApiError.notFound("Message introuvable.");

  return doc;
};

export const setStatus = async (id, status) => {
  const allowed = ["nouveau", "lu", "repondu", "archive"];

  if (!allowed.includes(status)) {
    throw ApiError.badRequest("Statut invalide.");
  }

  const doc = await Message.findByIdAndUpdate(
    id,
    { status },
    { new: true, runValidators: true }
  );

  if (!doc) throw ApiError.notFound("Message introuvable.");

  return doc.toJSON();
};

// Enregistre une réponse.
//
// IMPORTANT : `sentAt` reste vide. Aucun service d'envoi d'e-mail
// n'est branché à ce stade, et marquer la réponse comme envoyée
// ferait croire à l'équipe que le visiteur l'a reçue. Le champ sera
// renseigné le jour où un envoi réel a lieu.
export const reply = async (id, { body, user }) => {
  const text = String(body ?? "").trim();

  if (!text) {
    throw ApiError.badRequest(
      "La réponse ne peut pas être vide."
    );
  }

  const doc = await Message.findById(id);

  if (!doc) throw ApiError.notFound("Message introuvable.");

  doc.replies.push({ body: text, author: user.id });
  doc.status = "repondu";

  await doc.save();

  return doc.toJSON();
};

export const remove = async (id) => {
  const doc = await Message.findByIdAndDelete(id);

  if (!doc) throw ApiError.notFound("Message introuvable.");

  return true;
};
