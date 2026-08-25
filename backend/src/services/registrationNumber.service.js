import RegistrationCounter from "../models/RegistrationCounter.js";
import { ApiError } from "../utils/ApiError.js";

// Génération et validation du matricule des membres.
//
// Les fonctions PURES du format (analyse, mise en forme, lettre de
// contrôle, rang) vivent dans `utils/registrationFormat.js` : le
// modèle `Member` en a besoin lui aussi, et un modèle n'a pas à
// dépendre d'un service. Elles sont réexportées ici pour que tous les
// appelants historiques (`submission.service.js`, `auth.service.js`,
// `routes/index.js`, `memberExport.service.js`…) restent inchangés.
export {
  letterForNumber,
  normalizeRegistrationNumber,
  formatRegistrationNumber,
  parseRegistrationNumber,
  hasValidControlLetter,
  registrationOrderOf,
  MAX_NUMBER,
  UNRANKED,
} from "../utils/registrationFormat.js";

import { letterForNumber, MAX_NUMBER } from "../utils/registrationFormat.js";

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
// d'inscription (symptôme observé dans l'annuaire, trié sur
// `Member.registrationOrder`).
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
