import { validateEnv } from "../config/env.js";
import { connectDB, disconnectDB } from "../config/db.js";

import SocialContribution from "../models/SocialContribution.js";
import SocialLedgerEntry from "../models/SocialLedgerEntry.js";
import SocialFundYear from "../models/SocialFundYear.js";

import { SOCIAL_START_YEAR } from "../services/socialFundYear.service.js";

// Ramène le point de départ du Service Social à janvier 2026.
//
// Contexte : le module avait d'abord été cadré sur 2024. La génération
// automatique avait donc ouvert des mois dus pour 2024 et 2025 à tous
// les membres — une dette réclamée à des gens qui, pour beaucoup,
// avaient déjà réglé sur le registre papier de l'époque. La décision
// est de repartir de 2026 et de laisser le responsable ressaisir les
// seuls arriérés 2025 réellement dus, membre par membre, depuis la
// fiche sociale (voir recordLegacyArrears).
//
// Ce que le script supprime :
//   - les lignes de cotisation antérieures à SOCIAL_START_YEAR qui
//     n'ont JAMAIS reçu d'argent (amountPaid = 0, aucune référence de
//     reçu, statut non_paye) ;
//   - les exercices de caisse antérieurs à SOCIAL_START_YEAR qui sont
//     vides (aucun mouvement, solde d'ouverture et de clôture à zéro).
//
// Ce qu'il ne supprime JAMAIS, et sur quoi il s'arrête en le
// signalant : toute ligne qui porte de l'argent (paiement même
// partiel, référence de reçu, exonération, annulation) et tout
// exercice qui porte un mouvement ou un solde. Effacer ça ferait
// disparaître de la trésorerie — c'est une décision humaine, pas
// celle d'un script.
//
// SANS ÉCRITURE PAR DÉFAUT : affiche son plan et sort. `--apply` pour
// exécuter (convention commune aux scripts de reprise du projet).
//
// Usage :
//   node backend/src/scripts/resetSocialStartYear.js
//   node backend/src/scripts/resetSocialStartYear.js --apply

const APPLY = process.argv.includes("--apply");

// Une ligne « vierge » n'a jamais rien encaissé ni fait l'objet d'une
// décision. Le filtre est volontairement redondant (statut ET montant
// ET référence) : chacune des trois conditions suffirait dans un jeu
// de données sain, les trois ensemble protègent d'un état incohérent.
const BLANK_CONTRIBUTION = {
  year: { $lt: SOCIAL_START_YEAR },
  status: "non_paye",
  amountPaid: { $lte: 0 },
  reference: { $in: [null, undefined] },
};

const summarize = (rows) =>
  rows
    .map((row) => `${row._id} : ${row.n} ligne(s)`)
    .join("\n      ") || "aucune";

const run = async () => {
  try {
    validateEnv();
  } catch (error) {
    console.error(`\n${error.message}\n`);

    process.exit(1);
  }

  await connectDB();

  console.log(
    `\nRemise à zéro du Service Social avant ${SOCIAL_START_YEAR}` +
      `${APPLY ? "" : "  (SIMULATION — relancer avec --apply pour écrire)"}\n`
  );

  // ---- Cotisations -------------------------------------------------

  const blankByYear = await SocialContribution.aggregate([
    { $match: BLANK_CONTRIBUTION },
    { $group: { _id: "$year", n: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  const blankCount = blankByYear.reduce((total, row) => total + row.n, 0);

  console.log("  Cotisations sans aucun encaissement, à supprimer :");
  console.log(`      ${summarize(blankByYear)}`);

  const kept = await SocialContribution.find({
    year: { $lt: SOCIAL_START_YEAR },
    $nor: [BLANK_CONTRIBUTION],
  })
    .select("year month status amountPaid reference member")
    .lean();

  if (kept.length > 0) {
    console.log(
      `\n  ⚠ ${kept.length} ligne(s) antérieure(s) portent de l'argent ou une` +
        " décision : CONSERVÉES, à traiter à la main."
    );

    for (const line of kept.slice(0, 20)) {
      console.log(
        `      ${line.year}-${String(line.month).padStart(2, "0")} ` +
          `${line.status} payé=${line.amountPaid} ref=${line.reference ?? "—"} ` +
          `membre=${line.member}`
      );
    }

    if (kept.length > 20) console.log(`      … et ${kept.length - 20} autre(s)`);
  }

  // ---- Exercices de caisse ------------------------------------------

  const oldYears = await SocialFundYear.find({
    year: { $lt: SOCIAL_START_YEAR },
  }).lean();

  const emptyYears = [];
  const keptYears = [];

  for (const fundYear of oldYears) {
    const movements = await SocialLedgerEntry.countDocuments({
      church: fundYear.church,
      year: fundYear.year,
    });

    const isEmpty =
      movements === 0 &&
      !fundYear.openingBalance &&
      !fundYear.closingBalance;

    (isEmpty ? emptyYears : keptYears).push({ ...fundYear, movements });
  }

  console.log("\n  Exercices de caisse vides, à supprimer :");
  console.log(
    `      ${
      emptyYears
        .map((y) => `église ${y.church} / ${y.year}`)
        .join(", ") || "aucun"
    }`
  );

  if (keptYears.length > 0) {
    console.log(
      "\n  ⚠ Exercices antérieurs NON vides : CONSERVÉS, à traiter à la main."
    );

    for (const y of keptYears) {
      console.log(
        `      église ${y.church} / ${y.year} — ${y.movements} mouvement(s), ` +
          `ouverture ${y.openingBalance}, clôture ${y.closingBalance ?? "—"}`
      );
    }
  }

  // ---- Écriture ------------------------------------------------------

  if (!APPLY) {
    console.log("\n  Rien n'a été écrit. Relancer avec --apply.\n");

    await disconnectDB();

    return;
  }

  const deletedContributions =
    blankCount > 0
      ? (await SocialContribution.deleteMany(BLANK_CONTRIBUTION)).deletedCount
      : 0;

  const deletedYears =
    emptyYears.length > 0
      ? (
          await SocialFundYear.deleteMany({
            _id: { $in: emptyYears.map((y) => y._id) },
          })
        ).deletedCount
      : 0;

  console.log(
    `\n  ${deletedContributions} cotisation(s) et ${deletedYears} exercice(s) supprimé(s).\n`
  );

  await disconnectDB();
};

run().catch(async (error) => {
  console.error("\nÉchec de la remise à zéro :", error.message, "\n");

  await disconnectDB().catch(() => {});

  process.exit(1);
});
