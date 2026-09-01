import ChildCounter from "../models/ChildCounter.js";
import { ApiError } from "../utils/ApiError.js";
import {
  formatChildFileNumber,
  MAX_CHILD_FILE_NUMBER,
} from "../utils/childFileNumber.js";

// Génération du numéro de dossier d'un enfant.
//
// Les fonctions PURES du format vivent dans utils/childFileNumber.js :
// le modèle `Child` en a besoin pour valider, et un modèle n'a pas à
// dépendre d'un service. Elles sont réexportées ici pour que les
// appelants n'aient qu'un seul point d'entrée à connaître — même
// montage que registrationNumber.service.js pour les matricules.
export {
  formatChildFileNumber,
  normalizeChildFileNumber,
  childFileNumberOf,
  isValidChildFileNumber,
  MAX_CHILD_FILE_NUMBER,
} from "../utils/childFileNumber.js";

// `findOneAndUpdate` + `$inc` + `upsert` : deux inscriptions
// simultanées ne peuvent jamais obtenir le même numéro, y compris au
// tout premier enfant enregistré. Même mécanisme que
// `nextRegistrationNumber` pour les matricules.
export const nextChildFileNumber = async () => {
  const counter = await ChildCounter.findOneAndUpdate(
    { key: "child" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  if (counter.seq > MAX_CHILD_FILE_NUMBER) {
    throw ApiError.conflict(
      `Le plafond de ${MAX_CHILD_FILE_NUMBER} dossiers enfants est atteint. ` +
        "Un développeur doit étendre le format avant d'enregistrer de nouveaux dossiers."
    );
  }

  return {
    fileNumber: formatChildFileNumber(counter.seq),
    number: counter.seq,
  };
};

// Un numéro saisi à la main (reprise du registre papier, correction)
// ne passe pas par le compteur : sans cet appel, le compteur resterait
// en retard et le prochain enfant enregistré pourrait recevoir un
// numéro déjà attribué — collision garantie sur l'index unique.
//
// `$max` ne fait jamais reculer le compteur : un numéro inférieur au
// dernier émis n'a aucun effet. Repris tel quel de
// `advancePastManualNumber` (matricules), qui règle exactement le même
// problème.
export const advancePastManualChildNumber = async (number) => {
  if (!Number.isInteger(number) || number < 1) return;

  await ChildCounter.findOneAndUpdate(
    { key: "child" },
    { $max: { seq: number } },
    { upsert: true }
  );
};
