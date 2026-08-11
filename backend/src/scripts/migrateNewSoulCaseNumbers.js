import { validateEnv } from "../config/env.js";
import { connectDB, disconnectDB } from "../config/db.js";

import NewSoul from "../models/NewSoul.js";

// Réaligne les numéros de dossier "nouvelle âme" déjà en base sur le
// nouveau format à 3 chiffres minimum (voir
// newSoulNumber.service.js) : "AN-2026-0001" -> "AN-2026-001".
//
// Transformation sans risque de collision : pour un même
// couple (année, rang), l'ancien format produisait TOUJOURS 4
// chiffres (0001..0999 pour les rangs 1 à 999), jamais 3 — donc
// aucune valeur "nouveau format" ne peut déjà exister comme ancienne
// valeur d'un autre dossier. Les dossiers dont le rang est déjà ≥
// 1000 ne changent pas (le padding à 3 ou 4 chiffres n'y fait aucune
// différence).
//
// Nécessite --confirm pour éviter une exécution accidentelle.
//
// Usage : node backend/src/scripts/migrateNewSoulCaseNumbers.js --confirm

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

  const newSouls = await NewSoul.find({}, "caseNumber").lean();

  const updates = [];

  for (const doc of newSouls) {
    const match = CASE_NUMBER_RE.exec(doc.caseNumber ?? "");

    if (!match) continue;

    const [, year, rawNumber] = match;
    const reformatted = `AN-${year}-${String(Number(rawNumber)).padStart(3, "0")}`;

    if (reformatted !== doc.caseNumber) {
      updates.push({ _id: doc._id, from: doc.caseNumber, to: reformatted });
    }
  }

  console.log(`\n${updates.length} dossier(s) à reformater sur ${newSouls.length} au total.\n`);

  for (const update of updates) {
    console.log(`  ${update.from}  ->  ${update.to}`);
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

  console.log(`\n${updates.length} dossier(s) reformaté(s).\n`);

  await disconnectDB();
};

run().catch(async (error) => {
  console.error("\nÉchec de la migration :", error.message, "\n");

  await disconnectDB().catch(() => {});

  process.exit(1);
});
