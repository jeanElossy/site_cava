import "dotenv/config";

import { validateEnv } from "../config/env.js";
import { connectDB, disconnectDB } from "../config/db.js";

import Member from "../models/Member.js";
import {
  registrationOrderOf,
  UNRANKED,
} from "../utils/registrationFormat.js";

// Renseigne `Member.registrationOrder` sur les membres déjà en base.
//
// Ce champ est le NUMÉRO D'ORDRE contenu dans le matricule, juste avant
// la lettre finale : dans « 1ME 19-016 P », c'est 016 — le 16e membre
// enregistré de l'église. C'est lui, et lui seul, qui donne l'ordre
// d'affichage de l'annuaire.
//
// Il est calculé automatiquement à chaque écriture (hooks du modèle,
// voir Member.js), mais un champ ajouté après coup n'existe évidemment
// pas sur les documents écrits avant. Sans cette reprise, l'API trie
// sur un champ absent et retombe silencieusement sur l'ordre
// alphabétique des noms.
//
// À N'EXÉCUTER QU'UNE FOIS (mais sans risque à relancer : la valeur
// est entièrement dérivée du matricule, donc toujours recalculée à
// l'identique).
//
// PAR DÉFAUT, LE SCRIPT N'ÉCRIT RIEN : il affiche le plan.
// Ajouter `--apply` pour l'exécuter réellement.
//
// Usage :
//   node backend/src/scripts/backfillRegistrationOrder.js
//   node backend/src/scripts/backfillRegistrationOrder.js --apply

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
    `\nNuméro d'ordre des matricules — mode ${
      APPLY ? "RÉEL (--apply)" : "SIMULATION (aucune écriture)"
    }\n`
  );

  const members = await Member.find({})
    .select("registrationNumber registrationOrder church lastName firstName")
    .lean();

  const toUpdate = members
    .map((member) => ({
      member,
      order: registrationOrderOf(member.registrationNumber),
    }))
    .filter(({ member, order }) => member.registrationOrder !== order);

  if (toUpdate.length === 0) {
    console.log(`  ${members.length} membre(s) : tous déjà à jour.\n`);

    await disconnectDB();

    return;
  }

  const unranked = toUpdate.filter(({ order }) => order === UNRANKED);

  console.log(
    `  ${members.length} membre(s) en base, ${toUpdate.length} à mettre à jour.\n`
  );

  if (unranked.length > 0) {
    console.log(
      `  ${unranked.length} membre(s) sans matricule exploitable seront placés en fin de liste :`
    );

    for (const { member } of unranked) {
      console.log(`    ${member.lastName} ${member.firstName}`);
    }

    console.log("");
  }

  if (!APPLY) {
    // Aperçu de l'ordre obtenu, pour vérifier avant d'écrire.
    const preview = [...toUpdate]
      .sort(
        (a, b) =>
          (a.member.church ?? 0) - (b.member.church ?? 0) || a.order - b.order
      )
      .slice(0, 10);

    console.log("  Aperçu des 10 premiers dans le nouvel ordre :");

    for (const { member, order } of preview) {
      console.log(
        `    ${String(order).padStart(3, "0")}  ${member.registrationNumber}  ${member.lastName} ${member.firstName}`
      );
    }

    console.log(
      "\n  SIMULATION : rien n'a été écrit. Relancez avec --apply pour appliquer.\n"
    );

    await disconnectDB();

    return;
  }

  // `bulkWrite` plutôt qu'une écriture par membre : une seule
  // aller-retour réseau, et `$set` d'un champ dérivé ne déclenche
  // aucune validation à repasser.
  const result = await Member.bulkWrite(
    toUpdate.map(({ member, order }) => ({
      updateOne: {
        filter: { _id: member._id },
        update: { $set: { registrationOrder: order } },
      },
    }))
  );

  console.log(`  ${result.modifiedCount} membre(s) mis à jour.\n`);

  await disconnectDB();
};

run().catch(async (error) => {
  console.error("\nÉchec de la reprise :", error.message, "\n");

  await disconnectDB().catch(() => {});

  process.exit(1);
});
