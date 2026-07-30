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

// Ordre chronologique réel d'inscription : PAS l'ordre alphabétique du
// matricule complet, qui trierait par code de bergerie (positions 2-3)
// avant le numéro de séquence (positions 5-7) et mélangerait donc les
// rangs. Les membres sans matricule sont placés à la fin.
export const compareByRegistrationOrder = (a, b) => {
  const parsedA = parseRegistrationNumber(a?.registrationNumber);
  const parsedB = parseRegistrationNumber(b?.registrationNumber);

  if (!parsedA && !parsedB) return 0;
  if (!parsedA) return 1;
  if (!parsedB) return -1;

  if (parsedA.church !== parsedB.church) {
    return parsedA.church - parsedB.church;
  }

  return parsedA.number - parsedB.number;
};
