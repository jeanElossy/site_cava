import { env } from "../config/env.js";

// La photo d'un membre est un champ texte libre en base
// (`Member.photo`) — rien n'empêche mécaniquement d'y écrire
// n'importe quelle URL, qu'elle passe par une soumission publique
// falsifiée (le champ `photo` transite tel quel dans
// submission.service.js, jamais généré par le serveur) ou par une
// saisie manuelle dans l'admin (`FileField` autorise "saisir une
// adresse à la main"). Or `memberCardSvg.service.js` fait FAIRE une
// requête AU SERVEUR vers cette URL (`loadImage`) pour générer la
// carte : sans cette vérification, n'importe quelle adresse (service
// interne, métadonnées cloud, etc.) serait interrogée par le serveur
// lui-même sur commande d'un attaquant (SSRF).
//
// Utilitaire pur (aucune dépendance vers un service), volontairement
// importable depuis un modèle : appliqué à la fois comme validateur
// de schéma (Member.js — garantit l'invariant quel que soit le chemin
// d'écriture) et avant tout appel à `loadImage` en défense en
// profondeur (memberCardSvg.service.js), et à l'ingestion d'une
// soumission publique (submission.service.js).
export const isTrustedMemberPhotoUrl = (value) => {
  if (typeof value !== "string" || !value) return false;

  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;
  if (parsed.hostname.toLowerCase() !== "res.cloudinary.com") return false;

  // Restreint à NOTRE compte Cloudinary (pas n'importe quel compte
  // Cloudinary) et au dossier réservé aux membres — cohérent avec
  // `FOLDERS.members` dans upload.service.js.
  if (!env.CLOUDINARY_CLOUD_NAME) return false;

  const expectedPrefix = `/${env.CLOUDINARY_CLOUD_NAME}/image/upload/`;

  if (!parsed.pathname.startsWith(expectedPrefix)) return false;

  return parsed.pathname.includes("/cava/members/");
};
