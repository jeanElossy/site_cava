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
// Vérification commune : NOTRE compte Cloudinary, en HTTPS, dans un
// mode de livraison et un dossier attendus.
//
// `deliveryTypes` : « upload » livre un fichier PUBLIC, « authenticated »
// exige une URL signée à durée limitée. Les deux existent côté
// Cloudinary et produisent des chemins différents ; confondre les deux
// reviendrait à accepter une URL publique là où l'on croyait exiger
// une URL protégée.
const isTrustedCloudinaryUrl = (
  value,
  { folder, deliveryTypes = ["upload"], resourceTypes = ["image"] }
) => {
  if (typeof value !== "string" || !value) return false;

  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;
  if (parsed.hostname.toLowerCase() !== "res.cloudinary.com") return false;

  // Restreint à NOTRE compte Cloudinary, pas n'importe quel compte.
  if (!env.CLOUDINARY_CLOUD_NAME) return false;

  const matchesPrefix = resourceTypes.some((resourceType) =>
    deliveryTypes.some((deliveryType) =>
      parsed.pathname.startsWith(
        `/${env.CLOUDINARY_CLOUD_NAME}/${resourceType}/${deliveryType}/`
      )
    )
  );

  if (!matchesPrefix) return false;

  return parsed.pathname.includes(folder);
};

export const isTrustedMemberPhotoUrl = (value) =>
  // Cohérent avec `FOLDERS.members` dans upload.service.js.
  isTrustedCloudinaryUrl(value, { folder: "/cava/members/" });

// Photo d'un enfant. Même contrainte que pour un membre, et pour la
// même raison : le serveur peut avoir à la récupérer lui-même pour
// composer une fiche PDF, donc une URL libre l'exposerait à une requête
// vers une adresse choisie par un attaquant (SSRF).
//
// Reste en mode `upload` (public) : c'est un portrait affiché dans
// l'administration, pas une pièce d'état civil. Les documents, eux,
// sont protégés — voir ci-dessous.
export const isTrustedChildPhotoUrl = (value) =>
  isTrustedCloudinaryUrl(value, { folder: "/cava/children/" });

// Document d'un enfant : acte de naissance, autorisation parentale…
//
// EXIGE le mode `authenticated`. Une URL en `upload` serait publique et
// permanente : quiconque l'obtiendrait — un journal de serveur, un
// historique de navigateur, une capture d'écran partagée — pourrait
// lire l'acte de naissance d'un mineur, sans authentification et pour
// toujours. C'est exactement ce que ce validateur rend impossible,
// quel que soit le chemin qui a écrit le champ.
//
// `raw` en plus d'`image` : un PDF n'est pas une image pour Cloudinary.
export const isTrustedChildDocumentUrl = (value) =>
  isTrustedCloudinaryUrl(value, {
    folder: "/cava/children-documents/",
    deliveryTypes: ["authenticated"],
    resourceTypes: ["image", "raw"],
  });
