// Format du numéro de dossier d'un enfant : « CAVA-ENF-000001 ».
//
// Fonctions PURES, sans dépendance : le modèle `Child` en a besoin pour
// valider, le service pour générer, et le frontend en garde un miroir
// (src/utils/childFileNumber.js) — le dépôt n'a pas de code partagé
// entre le site et l'API, toute évolution du format se répercute des
// deux côtés.
//
// À NE PAS CONFONDRE avec le matricule des membres
// (utils/registrationFormat.js, « 1ME19016P ») : un enfant n'a pas de
// matricule et ne reçoit pas de carte de membre. Les deux formats sont
// volontairement dissemblables pour qu'aucune confusion ne soit possible
// à l'œil nu, ni à la saisie.

export const CHILD_FILE_PREFIX = "CAVA-ENF-";

// 6 chiffres : 999 999 dossiers. Le format du matricule membre plafonne
// lui à 999 PAR ÉGLISE, ce qui a déjà failli poser problème ; ici le
// compteur est unique pour tout le réseau, d'où la marge plus large.
export const CHILD_FILE_DIGITS = 6;

export const MAX_CHILD_FILE_NUMBER = 10 ** CHILD_FILE_DIGITS - 1;

export const CHILD_FILE_PATTERN = /^CAVA-ENF-\d{6}$/;

// Met en forme un rang : 1 → « CAVA-ENF-000001 ».
export const formatChildFileNumber = (number) => {
  if (!Number.isInteger(number) || number < 1) return null;

  return CHILD_FILE_PREFIX + String(number).padStart(CHILD_FILE_DIGITS, "0");
};

// Répare ce qu'un humain écrit en recopiant : minuscules, espaces,
// tirets manquants ou en trop, et les confusions O/0 sur la partie
// numérique — le format impose la nature de chaque caractère, la
// correction est donc déterministe (même raisonnement que
// `normalizeRegistrationNumber` pour les matricules).
export const normalizeChildFileNumber = (value) => {
  if (typeof value !== "string") return null;

  const compact = value.toUpperCase().replace(/[\s-]/g, "");

  if (!compact.startsWith("CAVAENF")) return null;

  const digits = compact
    .slice(7)
    .replace(/O/g, "0")
    .replace(/I|L/g, "1");

  if (!/^\d{1,6}$/.test(digits)) return null;

  return CHILD_FILE_PREFIX + digits.padStart(CHILD_FILE_DIGITS, "0");
};

// Rang contenu dans un numéro, ou `null` si la valeur n'est pas un
// numéro de dossier valide.
export const childFileNumberOf = (value) => {
  const normalized = normalizeChildFileNumber(value);

  if (!normalized) return null;

  return Number.parseInt(normalized.slice(CHILD_FILE_PREFIX.length), 10);
};

export const isValidChildFileNumber = (value) =>
  typeof value === "string" && CHILD_FILE_PATTERN.test(value);
