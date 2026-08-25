// Miroir des fonctions pures de
// backend/src/services/registrationNumber.service.js.
//
// Dupliqué volontairement : le front et l'API n'ont pas de code
// partagé dans ce dépôt. Toute modification du format doit être
// répercutée des deux côtés.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SHAPE = /^([1-5])([A-Z]{2})(\d{2})(\d{3})([A-Z])$/;

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
