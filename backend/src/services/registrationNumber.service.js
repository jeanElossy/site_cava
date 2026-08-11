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

// Un matricule saisi à la main (membre historique ajouté depuis
// l'administration, correction d'un matricule existant) contourne
// `nextRegistrationNumber` : il n'avance jamais le compteur de son
// église. Sans cet appel en complément, le compteur reste en retard sur
// ce numéro manuel, et la prochaine inscription en ligne peut se voir
// attribuer un numéro qui lui est inférieur — deux matricules valides,
// sans collision, mais dont l'ordre ne correspond plus à l'ordre réel
// d'inscription (symptôme observé dans la liste des membres, triée par
// numéro : voir `compareByRegistrationOrder` côté frontend).
//
// `$max` ne fait jamais reculer le compteur : un numéro manuel inférieur
// au dernier numéro déjà émis automatiquement n'a aucun effet, comme
// pour l'import du registre papier (`seed-legacy-members.js`), dont ce
// correctif reprend exactement le même mécanisme.
export const advancePastManualNumber = async ({ church, number }) => {
  if (!church || !Number.isInteger(number) || number < 1) return;

  await RegistrationCounter.findOneAndUpdate(
    { church },
    { $max: { lastNumber: number } },
    { upsert: true }
  );
};
