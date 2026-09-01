import crypto from "node:crypto";

import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

// Envoi de fichiers vers Cloudinary — signature côté serveur.
//
// ------------------------------------------------------------------
// POURQUOI SIGNER ICI PLUTÔT QUE D'ENVOYER DEPUIS LE SERVEUR
// ------------------------------------------------------------------
// Deux approches existent pour téléverser :
//
//   1. le navigateur envoie le fichier à notre API, qui le relaie à
//      Cloudinary ;
//   2. notre API délivre une signature, et le navigateur envoie le
//      fichier DIRECTEMENT à Cloudinary.
//
// La seconde est retenue. La première ferait transiter chaque vidéo
// par un service Render gratuit limité en mémoire et en temps de
// requête : un fichier de 200 Mo le ferait tomber. Ici, notre serveur
// ne voit jamais le fichier — seulement une demande de signature.
//
// ------------------------------------------------------------------
// POURQUOI SIGNÉ ET NON « UNSIGNED »
// ------------------------------------------------------------------
// Cloudinary propose des « upload presets » non signés, plus simples :
// une chaîne publique suffit à téléverser. Mais cette chaîne se lit
// dans le code du site, et n'importe qui pourrait alors remplir votre
// compte — jusqu'à épuiser le quota gratuit, voire y déposer des
// contenus dont vous seriez responsable.
//
// Avec la signature, il faut d'abord être authentifié sur notre API.

const SIGNATURE_TTL_SECONDS = 3600;

// Dossiers autorisés. Liste blanche volontaire : sans elle, un
// paramètre `folder` libre laisserait écrire n'importe où dans le
// compte, y compris par-dessus des fichiers existants.
const FOLDERS = {
  medias: "cava/medias",
  events: "cava/events",
  ministries: "cava/ministries",
  members: "cava/members",
  // Preuves de don (public, non authentifié — voir la route dédiée
  // POST /api/donations/proof-signature) et QR des moyens de
  // paiement (admin, via /api/admin/uploads/signature).
  donations: "cava/donations",
  paymentMethods: "cava/payment-methods",
  // Pièces justificatives des aides sociales (admin, via
  // /api/admin/uploads/signature) — Service Social Phase 2.
  socialAids: "cava/social-aids",
  // Photo d'un enfant (module Enfants) — PUBLIQUE comme celle d'un
  // membre : c'est un portrait affiché dans l'administration.
  children: "cava/children",
  // Documents d'un enfant : acte de naissance, autorisations…
  // ⚠️ Ce dossier est le SEUL à être livré en mode `authenticated`
  // (voir DELIVERY_TYPES juste en dessous). Ne jamais l'utiliser pour
  // un envoi ordinaire, et ne jamais retirer son entrée ci-dessous.
  childrenDocuments: "cava/children-documents",
  divers: "cava/divers",
};

// MODE DE LIVRAISON par dossier.
//
// `upload` (défaut) : l'URL produite est PUBLIQUE et permanente.
// C'est le comportement historique, et il convient à tout ce que le
// site affiche de toute façon publiquement.
//
// `authenticated` : le fichier n'est atteignable que par une URL
// SIGNÉE, délivrée à la demande après contrôle des droits (voir
// `createPrivateDownloadUrl` plus bas). Réservé aux documents
// d'enfants — des pièces d'état civil de mineurs, dont une URL publique
// serait lisible pour toujours par quiconque la récupérerait dans un
// journal de serveur ou un historique de navigateur.
//
// Ce mode entre dans les PARAMÈTRES SIGNÉS : le navigateur ne peut donc
// pas demander un envoi public dans ce dossier, Cloudinary rejetterait
// la signature.
const DELIVERY_TYPES = {
  childrenDocuments: "authenticated",
};

// Formats autorisés par dossier, eux aussi SIGNÉS.
//
// Sans cette liste, la seule vérification de format serait celle du
// navigateur (services/uploads.js) — contournable en trois clics. Ici,
// c'est Cloudinary qui refuse le fichier, quoi qu'envoie le client.
const ALLOWED_FORMATS = {
  childrenDocuments: ["pdf", "jpg", "jpeg", "png"],
  children: ["jpg", "jpeg", "png", "webp"],
};

// RÔLES AUTORISÉS À ÉCRIRE DANS UN DOSSIER.
//
// `/api/admin/uploads/signature` n'exige que `requireAuth` : TOUT
// compte authentifié peut demander une signature — y compris un agent
// SOA, un compte du Service Social ou un moniteur, dont aucun n'a de
// raison de déposer un acte de naissance.
//
// C'était sans conséquence tant que tous les dossiers accueillaient du
// contenu de site (médias, événements). Ça ne l'est plus avec les
// documents d'enfants. Le contrôle est posé ICI plutôt que dans la
// route, parce que le service est le point de passage unique : une
// seconde route de signature ajoutée un jour hériterait de la règle
// sans que personne ait à y penser.
//
// Un dossier absent de cette table reste ouvert à tout compte
// authentifié — comportement historique, volontairement inchangé.
const FOLDER_ROLES = {
  childrenDocuments: ["admin", "responsable_ecole_dimanche"],
  children: ["admin", "responsable_ecole_dimanche"],
};

export const isConfigured = () =>
  Boolean(
    env.CLOUDINARY_CLOUD_NAME &&
      env.CLOUDINARY_API_KEY &&
      env.CLOUDINARY_API_SECRET
  );

// Signature Cloudinary : les paramètres triés par ordre alphabétique,
// concaténés en `clé=valeur` séparés par `&`, suivis du secret, le
// tout haché en SHA-1. C'est le format imposé par leur API.
const sign = (params) => {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return crypto
    .createHash("sha1")
    .update(payload + env.CLOUDINARY_API_SECRET)
    .digest("hex");
};

export const createSignature = ({ folder, user } = {}) => {
  if (!isConfigured()) {
    throw ApiError.badRequest(
      "L'envoi de fichiers n'est pas configuré : les variables CLOUDINARY_* sont absentes côté serveur."
    );
  }

  const key = FOLDERS[folder] ? folder : "divers";
  const target = FOLDERS[key];

  // Voir FOLDER_ROLES : les dossiers sensibles ne s'ouvrent pas à tout
  // compte authentifié. `user` est absent sur la route PUBLIQUE de
  // signature (photo d'inscription), qui impose « members » de son
  // côté et ne peut donc jamais atteindre un dossier restreint.
  const allowedRoles = FOLDER_ROLES[key];

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    throw ApiError.forbidden(
      "Votre rôle ne permet pas de déposer un fichier dans cet espace."
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);

  // Seuls ces paramètres sont signés, et c'est le serveur qui les
  // fixe. Cloudinary rejette tout envoi dont les paramètres signés
  // diffèrent : le navigateur ne peut donc pas changer le dossier ni
  // écraser un fichier existant en imposant son propre `public_id`.
  const signed = {
    folder: target,
    timestamp,
  };

  const deliveryType = DELIVERY_TYPES[key];

  // Le mode de livraison est signé : impossible de demander un envoi
  // public dans un dossier protégé. Voir DELIVERY_TYPES.
  if (deliveryType) signed.type = deliveryType;

  const allowedFormats = ALLOWED_FORMATS[key];

  // Cloudinary attend une liste séparée par des virgules, et la
  // signature porte exactement la chaîne envoyée — d'où la même valeur
  // des deux côtés, construite une seule fois.
  if (allowedFormats) signed.allowed_formats = allowedFormats.join(",");

  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    folder: target,
    timestamp,
    ...(deliveryType ? { type: deliveryType } : {}),
    ...(allowedFormats ? { allowedFormats: signed.allowed_formats } : {}),
    signature: sign(signed),
    expiresIn: SIGNATURE_TTL_SECONDS,
  };
};

// ------------------------------------------------------------------
// Consultation d'un fichier PROTÉGÉ (mode `authenticated`)
// ------------------------------------------------------------------

// Durée de validité d'un lien de consultation. Assez pour ouvrir le
// document et le lire, trop court pour qu'un lien retrouvé dans un
// historique de navigateur serve encore.
const PRIVATE_URL_TTL_SECONDS = 300;

// Produit une URL de téléchargement SIGNÉE ET DATÉE pour un fichier
// stocké en mode `authenticated`.
//
// C'est le mécanisme `private_download_url` de Cloudinary, écrit à la
// main (le projet n'embarque pas leur SDK — voir `sign` plus haut, qui
// fait déjà exactement le même travail pour les envois).
//
// POURQUOI CELUI-CI ET PAS UNE « SIGNED URL » ORDINAIRE : une URL de
// livraison signée empêche de modifier les paramètres, mais elle
// n'expire jamais. Pour l'acte de naissance d'un mineur, une URL
// éternelle est précisément ce qu'on cherche à éviter. Ici,
// `expires_at` entre dans la signature : passé le délai, Cloudinary
// refuse, et il n'y a rien à révoquer.
export const createPrivateDownloadUrl = ({
  publicId,
  format,
  resourceType = "image",
  attachment = false,
  ttlSeconds = PRIVATE_URL_TTL_SECONDS,
} = {}) => {
  if (!isConfigured()) {
    throw ApiError.badRequest(
      "L'envoi de fichiers n'est pas configuré : les variables CLOUDINARY_* sont absentes côté serveur."
    );
  }

  if (!publicId) {
    throw ApiError.badRequest("Le fichier demandé est introuvable.");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const expiresAt = timestamp + ttlSeconds;

  const params = {
    attachment: attachment ? "true" : "false",
    expires_at: expiresAt,
    format: format ?? "",
    public_id: publicId,
    timestamp,
    type: "authenticated",
  };

  const query = new URLSearchParams({
    ...params,
    api_key: env.CLOUDINARY_API_KEY,
    signature: sign(params),
  });

  return {
    url:
      `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}` +
      `/${resourceType}/download?${query.toString()}`,
    expiresAt: new Date(expiresAt * 1000),
  };
};

// Taille RÉELLE d'un fichier, demandée à Cloudinary.
//
// Cloudinary n'a pas de paramètre d'upload plafonnant la taille : les
// formats se signent (voir ALLOWED_FORMATS), la taille non. La
// vérification côté navigateur existe pour le confort, mais elle se
// contourne — un client modifié peut téléverser un fichier de 200 Mo.
//
// D'où cette vérification APRÈS coup, avant d'enregistrer le document
// en base : c'est le seul point où le serveur connaît la vraie taille.
// Un fichier hors limite est rejeté et supprimé (voir
// childDocument.service.js), plutôt que laissé orphelin sur le compte.
export const fetchResourceInfo = async ({
  publicId,
  resourceType = "image",
  deliveryType = "authenticated",
}) => {
  const timestamp = Math.floor(Date.now() / 1000);

  const credentials = Buffer.from(
    `${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`
  ).toString("base64");

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}` +
      `/resources/${resourceType}/${deliveryType}/${encodeURIComponent(publicId)}` +
      `?_=${timestamp}`,
    { headers: { Authorization: `Basic ${credentials}` } }
  );

  if (!response.ok) return null;

  const payload = await response.json().catch(() => null);

  if (!payload) return null;

  return {
    bytes: payload.bytes,
    format: payload.format,
    secureUrl: payload.secure_url,
  };
};

// Suppression définitive d'un fichier protégé.
export const destroyResource = async ({
  publicId,
  resourceType = "image",
  deliveryType = "authenticated",
}) => {
  const timestamp = Math.floor(Date.now() / 1000);

  const params = { public_id: publicId, timestamp, type: deliveryType };

  const body = new URLSearchParams({
    ...params,
    api_key: env.CLOUDINARY_API_KEY,
    signature: sign(params),
  });

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${resourceType}/destroy`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }
  );

  return response.ok;
};
