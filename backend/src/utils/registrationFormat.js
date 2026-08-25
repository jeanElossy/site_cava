// Format du matricule des membres — fonctions PURES, sans accès base.
//
// Extrait de `services/registrationNumber.service.js` (qui les
// réexporte, tous les appelants existants sont inchangés) pour que le
// modèle `Member` puisse s'en servir sans dépendre d'un service : le
// schéma a besoin de lire le rang d'inscription contenu dans le
// matricule, et une troisième copie du format aurait fini par diverger
// des deux autres.
//
// Format canonique stocké (9 caractères, sans espace) : "1OL25045S".
//   1        OL        25        045        S
//   église   bergerie  année     n° dans     lettre de
//   (1-5)    (2 lettres)(2 ch.)  l'église    contrôle
//                                (3 ch.)
//
// La lettre n'est JAMAIS saisie : elle se déduit du numéro
// (lettre = alphabet[(numéro - 1) % 26]). C'est un simple repère
// visuel de contrôle, pas un mécanisme de sécurité — elle permet à un
// administrateur de repérer une erreur de recopie avant de valider une
// inscription, comme observé sur le registre papier existant (un
// numéro dupliqué gardait la bonne lettre du rang réel).

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const SHAPE = /^([1-5])([A-Z]{2})(\d{2})(\d{3})([A-Z])$/;

// Plafond du compteur sur 3 chiffres. Au-delà, il faut un format sur 4
// chiffres — changement hors périmètre, qui casserait tous les
// matricules déjà attribués.
export const MAX_NUMBER = 999;

// Rang conventionnel d'un membre sans matricule exploitable : au-dessus
// du plafond du format, pour qu'un tri croissant le place À LA FIN de
// son église plutôt qu'en tête (ce que ferait un champ absent).
export const UNRANKED = MAX_NUMBER + 1;

export const letterForNumber = (number) => ALPHABET[(number - 1) % 26];

export const normalizeRegistrationNumber = (input) =>
  String(input ?? "")
    .toUpperCase()
    .replace(/[\s-]/g, "");

export const formatRegistrationNumber = (canonical) => {
  const match = SHAPE.exec(canonical ?? "");

  if (!match) return canonical ?? "";

  const [, church, flockCode, year, number, letter] = match;

  return `${church}${flockCode} ${year}-${number} ${letter}`;
};

export const parseRegistrationNumber = (canonical) => {
  const match = SHAPE.exec(canonical ?? "");

  if (!match) return null;

  const [, church, flockCode, year, number, letter] = match;

  return {
    church: Number(church),
    flockCode,
    year: Number(year),
    number: Number(number),
    letter,
  };
};

export const hasValidControlLetter = (canonical) => {
  const parsed = parseRegistrationNumber(canonical);

  if (!parsed) return false;

  return parsed.letter === letterForNumber(parsed.number);
};

// Rang d'inscription porté par un matricule, ou `UNRANKED`.
//
// Tolère la forme affichée avec espaces et tiret ("1OL 25-045 S") :
// c'est celle que l'administration a sous les yeux, donc celle qu'elle
// recopie.
export const registrationOrderOf = (value) => {
  const parsed = parseRegistrationNumber(normalizeRegistrationNumber(value));

  return parsed ? parsed.number : UNRANKED;
};
