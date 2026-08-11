import { validateEnv } from "../config/env.js";
import { connectDB, disconnectDB } from "../config/db.js";

import NewSoul from "../models/NewSoul.js";
import NewSoulCounter from "../models/NewSoulCounter.js";

// Renumérote les dossiers "nouvelle âme" déjà en base pour qu'ils
// soient consécutifs (001, 002, 003…) DANS L'ORDRE DE CRÉATION, par
// année — les numéros actuels comportent des trous (dossiers
// supprimés entre-temps). Complète
// migrateNewSoulCaseNumbers.js (qui ne faisait que retirer le zéro de
// tête, sans combler les trous).
//
// Après renumérotation, le compteur de chaque année (NewSoulCounter)
// est aligné sur le nombre de dossiers de cette année, pour que le
// PROCHAIN dossier créé continue la séquence sans trou
// (voir newSoulNumber.service.js).
//
// Nécessite --confirm pour éviter une exécution accidentelle.
//
// Usage : node backend/src/scripts/renumberNewSoulCaseNumbers.js --confirm

const CASE_NUMBER_RE = /^AN-(\d{4})-(\d+)$/;

const run = async () => {
  const confirm = process.argv.includes("--confirm");

  try {
    validateEnv();
  } catch (error) {
    console.error(`\n${error.message}\n`);

    process.exit(1);
  }

  await connectDB();

  const newSouls = await NewSoul.find({}, "caseNumber createdAt")
    .sort({ createdAt: 1 })
    .lean();

  const byYear = new Map();

  for (const doc of newSouls) {
    const match = CASE_NUMBER_RE.exec(doc.caseNumber ?? "");

    if (!match) {
      console.log(`  Ignoré (format inattendu) : ${doc.caseNumber}`);

      continue;
    }

    const [, year] = match;

    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(doc);
  }

  const updates = [];

  for (const [year, docs] of byYear) {
    docs.forEach((doc, index) => {
      const newCaseNumber = `AN-${year}-${String(index + 1).padStart(3, "0")}`;

      if (newCaseNumber !== doc.caseNumber) {
        updates.push({ _id: doc._id, from: doc.caseNumber, to: newCaseNumber });
      }
    });
  }

  console.log(
    `\n${updates.length} dossier(s) à renuméroter sur ${newSouls.length} au total, sur ${byYear.size} année(s).\n`
  );

  for (const update of updates) {
    console.log(`  ${update.from}  ->  ${update.to}`);
  }

  console.log("\nCompteur(s) après renumérotation :");

  for (const [year, docs] of byYear) {
    console.log(`  ${year} : lastNumber = ${docs.length}`);
  }

  if (!confirm) {
    console.log(
      "\nAucune modification effectuée (aperçu). Relancez avec --confirm pour appliquer.\n"
    );

    await disconnectDB();

    return;
  }

  for (const update of updates) {
    await NewSoul.updateOne({ _id: update._id }, { $set: { caseNumber: update.to } });
  }

  for (const [year, docs] of byYear) {
    await NewSoulCounter.findOneAndUpdate(
      { year: Number(year) },
      { $set: { lastNumber: docs.length } },
      { upsert: true }
    );
  }

  console.log(`\n${updates.length} dossier(s) renuméroté(s), compteur(s) aligné(s).\n`);

  await disconnectDB();
};

run().catch(async (error) => {
  console.error("\nÉchec de la renumérotation :", error.message, "\n");

  await disconnectDB().catch(() => {});

  process.exit(1);
});
