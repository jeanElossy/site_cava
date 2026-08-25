import "dotenv/config";

import { validateEnv } from "../config/env.js";
import { connectDB, disconnectDB } from "../config/db.js";

import Member from "../models/Member.js";
import {
  letterForNumber,
  parseRegistrationNumber,
} from "../utils/registrationFormat.js";

// Remise en cohérence des lettres de contrôle des matricules.
//
// La dernière lettre d'un matricule se DÉDUIT du numéro
// (lettre = alphabet[(numéro - 1) % 26]) : ce n'est pas une donnée
// saisissable, seulement un repère de recopie. Rien ne le vérifiait
// jusqu'ici, et un matricule saisi à la main depuis l'administration
// pouvait porter une lettre décalée — d'où une suite de lettres qui
// « ne s'enchaîne plus » alors que les numéros, eux, sont corrects.
//
// Le modèle refuse désormais un tel matricule (voir Member.js). Ce
// script répare les enregistrements ANTÉRIEURS à cette règle, qui
// seraient sinon impossibles à modifier depuis l'administration sans
// corriger d'abord leur matricule à la main.
//
// LE NUMÉRO FAIT FOI, PAS LA LETTRE : la séquence des numéros est la
// source de vérité (elle vient du compteur atomique par église), la
// lettre n'en est qu'une projection. Le script ne renumérote donc
// jamais personne — il ne réécrit que la lettre.
//
// PAR DÉFAUT, LE SCRIPT N'ÉCRIT RIEN : il affiche le diagnostic.
// Ajouter `--apply` pour corriger réellement.
//
// Usage :
//   node backend/src/scripts/fixRegistrationControlLetters.js
//   node backend/src/scripts/fixRegistrationControlLetters.js --apply

const APPLY = process.argv.includes("--apply");

const run = async () => {
  try {
    validateEnv();
  } catch (error) {
    console.error(`\n${error.message}\n`);
    process.exit(1);
  }

  await connectDB();

  console.log(
    `\nLettres de contrôle des matricules — mode ${
      APPLY ? "RÉEL (--apply)" : "SIMULATION (aucune écriture)"
    }\n`
  );

  const members = await Member.find({
    registrationNumber: { $exists: true, $ne: null },
  })
    .select("registrationNumber firstName lastName church")
    .lean();

  const broken = [];

  for (const member of members) {
    const parsed = parseRegistrationNumber(member.registrationNumber);

    if (!parsed) continue;

    const expected = letterForNumber(parsed.number);

    if (parsed.letter === expected) continue;

    broken.push({
      member,
      expected,
      corrected: `${member.registrationNumber.slice(0, 8)}${expected}`,
    });
  }

  if (broken.length === 0) {
    console.log("  Toutes les lettres de contrôle sont cohérentes.\n");

    await disconnectDB();

    return;
  }

  console.log(`  ${broken.length} matricule(s) à corriger :\n`);

  for (const { member, corrected } of broken) {
    console.log(
      `    ${member.registrationNumber} → ${corrected}   (${member.lastName} ${member.firstName}, église ${member.church})`
    );
  }

  console.log("");

  if (!APPLY) {
    console.log(
      "  SIMULATION : rien n'a été écrit. Relancez avec --apply pour corriger.\n"
    );

    await disconnectDB();

    return;
  }

  for (const { member, corrected } of broken) {
    // `updateOne` sur le document plutôt que `save()` : inutile de
    // repasser tout le document par la validation alors qu'on ne
    // touche qu'un caractère — et `registrationOrder` ne change pas,
    // puisque le numéro est inchangé.
    await Member.updateOne(
      { _id: member._id },
      { $set: { registrationNumber: corrected } }
    );
  }

  console.log(`  ${broken.length} matricule(s) corrigé(s).\n`);

  await disconnectDB();
};

run().catch(async (error) => {
  console.error("\nÉchec de la correction :", error.message, "\n");

  await disconnectDB().catch(() => {});

  process.exit(1);
});
