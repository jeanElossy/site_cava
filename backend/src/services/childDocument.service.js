import ChildDocument, {
  CHILD_DOCUMENT_MAX_BYTES,
  CHILD_DOCUMENT_QUOTA_BYTES,
} from "../models/ChildDocument.js";
import Child from "../models/Child.js";
import ChildGuardian from "../models/ChildGuardian.js";
import { ApiError } from "../utils/ApiError.js";
import {
  createPrivateDownloadUrl,
  destroyResource,
  fetchResourceInfo,
} from "./upload.service.js";

// Documents des enfants — actes de naissance, autorisations.
//
// ------------------------------------------------------------------
// CES FICHIERS NE SONT JAMAIS SERVIS PUBLIQUEMENT
// ------------------------------------------------------------------
// Ils sont stockés en mode `authenticated` (voir upload.service.js) :
// l'URL enregistrée en base ne suffit pas à les lire. Chaque
// consultation demande une URL SIGNÉE, valable quelques minutes,
// délivrée seulement après contrôle des droits — et journalisée.
//
// L'URL stockée n'est donc JAMAIS renvoyée au navigateur : c'est la
// règle centrale de ce fichier, et `publicDocument` en est la seule
// garantie mécanique.

// Représentation renvoyée à l'interface. Ne contient ni `url` ni
// `publicId` : deux champs qui, ensemble, permettraient de fabriquer
// un lien hors de tout contrôle.
const publicDocument = (document) => ({
  id: String(document._id),
  child: String(document.child),
  type: document.type,
  name: document.name,
  status: document.status,
  mimeType: document.mimeType,
  bytes: document.bytes,
  resourceType: document.resourceType,
  uploadedBy: document.uploadedBy,
  lastModifiedBy: document.lastModifiedBy ?? null,
  reviewedAt: document.reviewedAt ?? null,
  reviewNote: document.reviewNote ?? null,
  createdAt: document.createdAt,
  updatedAt: document.updatedAt,
});

export const list = async (childId) => {
  const documents = await ChildDocument.find({ child: childId })
    .sort({ createdAt: -1 })
    .lean();

  const used = documents.reduce((total, item) => total + (item.bytes ?? 0), 0);

  return {
    items: documents.map(publicDocument),
    storage: {
      used,
      quota: CHILD_DOCUMENT_QUOTA_BYTES,
      maxPerFile: CHILD_DOCUMENT_MAX_BYTES,
      percent: Math.round((used / CHILD_DOCUMENT_QUOTA_BYTES) * 100),
    },
  };
};

// Enregistre un document DÉJÀ téléversé vers Cloudinary.
//
// La taille est vérifiée ICI, auprès de Cloudinary, et non d'après ce
// que déclare le client : Cloudinary sait signer un format autorisé
// mais n'a pas de plafond de taille à l'upload, et la vérification du
// navigateur se contourne. C'est le seul point où le serveur connaît
// la taille réelle.
//
// Un fichier hors limite est supprimé du stockage plutôt que laissé
// orphelin — sinon il resterait facturé et invisible.
export const attach = async (childId, payload, actor) => {
  const child = await Child.findById(childId).select("_id").lean();

  if (!child) throw ApiError.notFound("Enfant introuvable.");

  const { publicId, url, type, name, resourceType = "image", mimeType } = payload ?? {};

  if (!publicId || !url) {
    throw ApiError.badRequest("Le fichier envoyé est incomplet.");
  }

  const info = await fetchResourceInfo({ publicId, resourceType });

  if (!info) {
    throw ApiError.unprocessable(
      "Le fichier n'a pas été retrouvé sur le service de stockage. Réessayez l'envoi."
    );
  }

  if (info.bytes > CHILD_DOCUMENT_MAX_BYTES) {
    await destroyResource({ publicId, resourceType });

    throw ApiError.unprocessable(
      `Fichier trop volumineux (${Math.round(info.bytes / 1024 / 1024)} Mo). Maximum : ${
        CHILD_DOCUMENT_MAX_BYTES / 1024 / 1024
      } Mo par document.`,
      { file: "Fichier trop volumineux." }
    );
  }

  const existing = await ChildDocument.find({ child: childId }).select("bytes").lean();
  const used = existing.reduce((total, item) => total + (item.bytes ?? 0), 0);

  if (used + info.bytes > CHILD_DOCUMENT_QUOTA_BYTES) {
    await destroyResource({ publicId, resourceType });

    throw ApiError.unprocessable(
      "L'espace de stockage de ce dossier est plein. Supprimez un document avant d'en ajouter un autre.",
      { file: "Quota atteint." }
    );
  }

  const document = await ChildDocument.create({
    child: childId,
    type,
    name,
    publicId,
    url,
    resourceType,
    mimeType,
    bytes: info.bytes,
    uploadedBy: actor,
    status: "en_attente",
  });

  return publicDocument(document.toObject());
};

// Délivre un lien de consultation à durée limitée.
//
// L'APPELANT DOIT JOURNALISER (`document_view`) : c'est le seul moyen
// de répondre un jour à « qui a consulté l'acte de naissance de cet
// enfant ». La journalisation est faite dans la route plutôt qu'ici
// pour disposer de l'adresse IP et du navigateur, que le service
// ignore — comme partout ailleurs dans le projet.
export const openLink = async (childId, documentId, { attachment = false } = {}) => {
  const document = await ChildDocument.findOne({
    _id: documentId,
    // Le document DOIT appartenir à l'enfant demandé : sans ce filtre,
    // un identifiant de document valide donnerait accès à la pièce
    // d'un autre enfant, en contournant tout contrôle par dossier.
    child: childId,
  }).lean();

  if (!document) throw ApiError.notFound("Document introuvable.");

  const { url, expiresAt } = createPrivateDownloadUrl({
    publicId: document.publicId,
    resourceType: document.resourceType,
    format: document.mimeType?.split("/")?.[1],
    attachment,
  });

  return {
    url,
    expiresAt,
    name: document.name,
    // Renvoyé pour que la route puisse journaliser précisément quel
    // document a été ouvert, et pour quel enfant.
    document: publicDocument(document),
  };
};

export const review = async (childId, documentId, { status, note }, actor) => {
  if (!["valide", "refuse"].includes(status)) {
    throw ApiError.badRequest("Statut de validation invalide.");
  }

  const document = await ChildDocument.findOneAndUpdate(
    { _id: documentId, child: childId },
    {
      status,
      reviewNote: note,
      reviewedBy: actor?.id,
      reviewedAt: new Date(),
    },
    { new: true }
  );

  if (!document) throw ApiError.notFound("Document introuvable.");

  return publicDocument(document.toObject());
};

// Suppression DÉFINITIVE, base et stockage.
//
// Contrairement aux enfants et aux classes, un document se supprime
// vraiment : le conserver « au cas où » reviendrait à garder une pièce
// d'état civil dont plus personne n'a l'usage, ce qui est exactement
// ce qu'une bonne gestion de données personnelles proscrit.
export const remove = async (childId, documentId) => {
  const document = await ChildDocument.findOne({
    _id: documentId,
    child: childId,
  });

  if (!document) throw ApiError.notFound("Document introuvable.");

  await destroyResource({
    publicId: document.publicId,
    resourceType: document.resourceType,
  });

  await document.deleteOne();

  return true;
};

// Auteur d'un dépôt, dans la forme attendue par le modèle.
//
// Un document peut être déposé par un compte (administrateur,
// responsable) ou apporté par un parent, qui n'a pas de compte — d'où
// l'auteur dénormalisé plutôt qu'une simple référence `User` (voir
// ChildDocument.js).
export const authorFromUser = (user, label) => ({
  kind: "user",
  id: user.id,
  name: user.name,
  label: label ?? user.role,
});

export const authorFromGuardian = async (guardianId, relation) => {
  const guardian = await ChildGuardian.findById(guardianId)
    .select("firstName lastName")
    .lean();

  if (!guardian) throw ApiError.notFound("Responsable introuvable.");

  return {
    kind: "guardian",
    id: guardian._id,
    name: `${guardian.firstName} ${guardian.lastName}`.trim(),
    label: relation,
  };
};
