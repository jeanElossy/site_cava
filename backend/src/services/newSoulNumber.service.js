import NewSoulCounter from "../models/NewSoulCounter.js";

// Génère le numéro de dossier "nouvelle âme" : "AN-2026-0001".
//   AN     "Âme Nouvelle"
//   2026   année d'ouverture
//   0001   rang dans l'année, sur 4 chiffres, remis à zéro chaque année
//
// `findOneAndUpdate` + `$inc` : deux créations simultanées ne peuvent
// jamais obtenir le même numéro, y compris à la toute première
// ouverture de l'année (upsert) — même principe que
// registrationNumber.service.js pour les matricules de membre.
export const nextCaseNumber = async (year = new Date().getFullYear()) => {
  const counter = await NewSoulCounter.findOneAndUpdate(
    { year },
    { $inc: { lastNumber: 1 } },
    { new: true, upsert: true }
  );

  return `AN-${year}-${String(counter.lastNumber).padStart(4, "0")}`;
};
