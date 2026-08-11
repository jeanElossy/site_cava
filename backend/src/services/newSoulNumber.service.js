import NewSoulCounter from "../models/NewSoulCounter.js";

// Génère le numéro de dossier "nouvelle âme" : "AN-2026-001".
//   AN     "Âme Nouvelle"
//   2026   année d'ouverture
//   001    rang dans l'année, sur 3 chiffres minimum (au-delà de 999,
//          le nombre s'étend naturellement sans troncature), remis à
//          zéro chaque année
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

  return `AN-${year}-${String(counter.lastNumber).padStart(3, "0")}`;
};
