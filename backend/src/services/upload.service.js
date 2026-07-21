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
  divers: "cava/divers",
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

export const createSignature = ({ folder } = {}) => {
  if (!isConfigured()) {
    throw ApiError.badRequest(
      "L'envoi de fichiers n'est pas configuré : les variables CLOUDINARY_* sont absentes côté serveur."
    );
  }

  const target = FOLDERS[folder] ?? FOLDERS.divers;

  const timestamp = Math.floor(Date.now() / 1000);

  // Seuls ces paramètres sont signés, et c'est le serveur qui les
  // fixe. Cloudinary rejette tout envoi dont les paramètres signés
  // diffèrent : le navigateur ne peut donc pas changer le dossier ni
  // écraser un fichier existant en imposant son propre `public_id`.
  const signed = {
    folder: target,
    timestamp,
  };

  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    folder: target,
    timestamp,
    signature: sign(signed),
    expiresIn: SIGNATURE_TTL_SECONDS,
  };
};
