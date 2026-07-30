import RegistrationCounter from "../models/RegistrationCounter.js";
import { ApiError } from "../utils/ApiError.js";

// Génération et validation du matricule des membres.
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

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SHAPE = /^([1-5])([A-Z]{2})(\d{2})(\d{3})([A-Z])$/;

// Plafond du compteur sur 3 chiffres. Au-delà, il faut un format sur 4
// chiffres — changement hors périmètre, qui casserait tous les
// matricules déjà attribués.
const MAX_NUMBER = 999;

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

// Incrémente le compteur atomique de l'église et construit le
// matricule correspondant.
//
// `findOneAndUpdate` + `$inc` : deux validations simultanées par deux
// administrateurs ne peuvent jamais obtenir le même numéro, y compris
// au tout premier enregistrement d'une église (upsert).
export const nextRegistrationNumber = async ({
  church,
  flockCode,
  year,
}) => {
  const counter = await RegistrationCounter.findOneAndUpdate(
    { church },
    { $inc: { lastNumber: 1 } },
    { new: true, upsert: true }
  );

  if (counter.lastNumber > MAX_NUMBER) {
    throw ApiError.conflict(
      `Le plafond de ${MAX_NUMBER} matricules pour l'église ${church} est atteint. ` +
        "Un développeur doit étendre le format avant de valider de nouvelles inscriptions pour cette église."
    );
  }

  const number = counter.lastNumber;
  const letter = letterForNumber(number);
  const yy = String(year).slice(-2).padStart(2, "0");
  const registrationNumber = `${church}${flockCode}${yy}${String(
    number
  ).padStart(3, "0")}${letter}`;

  return { registrationNumber, number, letter };
};

// Rend un numéro au compteur quand le membre qui le portait est
// supprimé — mais SEULEMENT si ce numéro est bien le tout dernier
// émis pour cette église (cas typique : inscription de test suivie
// d'une suppression immédiate). Sans cette condition, décrémenter
// serait dangereux : si d'autres inscriptions ont eu lieu entre-temps,
// ce numéro a pu être réattribué et deux membres se retrouveraient
// avec le même matricule.
//
// `updateOne({ church, lastNumber: number }, ...)` : la condition sur
// `lastNumber` rend l'opération atomique et sûre même en cas de
// suppressions concurrentes — elle ne peut réussir QUE si personne
// d'autre n'a avancé le compteur depuis.
export const releaseIfLastIssued = async ({ church, number }) => {
  if (!church || !Number.isInteger(number) || number < 1) return;

  await RegistrationCounter.updateOne(
    { church, lastNumber: number },
    { $set: { lastNumber: number - 1 } }
  );
};
