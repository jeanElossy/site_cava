// Miroir des fonctions pures de
// backend/src/services/registrationNumber.service.js.
//
// Dupliqué volontairement : le front et l'API n'ont pas de code
// partagé dans ce dépôt. Toute modification du format doit être
// répercutée des deux côtés.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SHAPE = /^([1-5])([A-Z]{2})(\d{2})(\d{3})([A-Z])$/;

export const letterForNumber = (number) => ALPHABET[(number - 1) % 26];

// Confusions de saisie les plus courantes sur un matricule recopié à
// la main ou lu sur une carte : le chiffre 0 et la lettre O, le chiffre
// 1 et la lettre I.
//
// La correction est DÉTERMINISTE : le format impose la nature de chaque
// position, donc un « 0 » en position de lettre ne peut être qu'un
// « O ». Miroir de `backend/src/utils/registrationFormat.js` — toute
// modification doit être répercutée des deux côtés.
const LETTER_POSITIONS = new Set([1, 2, 8]);
const DIGIT_LOOKALIKE_TO_LETTER = { 0: "O", 1: "I" };
const LETTER_LOOKALIKE_TO_DIGIT = { O: "0", I: "1" };

const repairLookalikes = (value) => {
  // Uniquement sur une chaîne de la bonne longueur : ailleurs la
  // position ne veut rien dire, et « corriger » abîmerait la valeur.
  if (value.length !== 9) return value;

  return Array.from(value, (char, index) =>
    LETTER_POSITIONS.has(index)
      ? DIGIT_LOOKALIKE_TO_LETTER[char] ?? char
      : LETTER_LOOKALIKE_TO_DIGIT[char] ?? char
  ).join("");
};

export const normalizeRegistrationNumber = (input) =>
  repairLookalikes(
    String(input ?? "")
      .toUpperCase()
      .replace(/[\s-]/g, "")
  );

export const formatRegistrationNumber = (canonical) => {
  const match = SHAPE.exec(canonical ?? "");

  if (!match) return canonical ?? "";

  const [, church, flockCode, year, number, letter] = match;

  return `${church}${flockCode} ${year}-${number} ${letter}`;
};

export const hasValidShape = (canonical) => SHAPE.test(canonical ?? "");

export const hasValidControlLetter = (canonical) => {
  const match = SHAPE.exec(canonical ?? "");

  if (!match) return false;

  const [, , , , number, letter] = match;

  return letter === letterForNumber(Number(number));
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

// L'ORDRE D'AFFICHAGE N'EST PLUS CALCULÉ ICI.
//
// Un comparateur `compareByRegistrationOrder` vivait à cet endroit et
// servait à retrier l'annuaire d'administration. Il a été retiré : la
// liste est paginée côté serveur, et retrier une PAGE déjà découpée
// par l'API selon un autre critère faisait « sauter » les matricules à
// l'affichage. L'ordre appartient désormais à l'API, qui trie sur
// `Member.registrationOrder` (voir backend/src/models/Member.js).
