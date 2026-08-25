import "dotenv/config";

import { validateEnv } from "../config/env.js";
import { connectDB, disconnectDB } from "../config/db.js";

import SocialFundSettings from "../models/SocialFundSettings.js";
import SocialFundYear from "../models/SocialFundYear.js";
import SocialLedgerEntry from "../models/SocialLedgerEntry.js";

import {
  SOCIAL_START_YEAR,
  currentYear,
} from "../services/socialFundYear.service.js";

// Migration vers les caisses annuelles du Service Social.
//
// Avant : une seule caisse perpétuelle par église
// (`SocialFundSettings.openingBalance` + tous les `SocialLedgerEntry`).
// Après : un exercice par église et par année (`SocialFundYear`), le
// solde de chaque année étant reporté sur la suivante.
//
// Ce que fait le script, dans cet ordre :
//   1. rattache chaque mouvement existant à son exercice (`year`,
//      déduit de `createdAt` — c'est une comptabilité de caisse, voir
//      SocialFundYear.js) ;
//   2. ouvre les exercices de 2024 à l'année courante, en reprenant
//      l'ancien solde initial de l'église comme solde d'ouverture 2024 ;
//   3. clôture les exercices révolus, avec leur solde de clôture figé.
//
// IDEMPOTENT : relancer ne recrée rien et ne réécrit aucun mouvement
// déjà rattaché. Une caisse déjà clôturée n'est jamais rouverte.
//
// PAR DÉFAUT, LE SCRIPT N'ÉCRIT RIEN : il affiche le plan. Ajouter
// `--apply` pour l'exécuter réellement.
//
// Usage :
//   node backend/src/scripts/migrateSocialFundYears.js
//   node backend/src/scripts/migrateSocialFundYears.js --apply

const APPLY = process.argv.includes("--apply");

const money = (value) => `${Number(value ?? 0).toLocaleString("fr-FR")} F`;

// Un mouvement antérieur à 2024 (impossible en principe : le module
// est plus récent) serait rattaché à un exercice qui n'existera
// jamais, et disparaîtrait donc de toutes les caisses. On le rattache
// au premier exercice, en le signalant.
const exerciceYearOf = (createdAt) => {
  const year = new Date(createdAt ?? Date.now()).getUTCFullYear();

  return Math.max(year, SOCIAL_START_YEAR);
};

const run = async () => {
  try {
    validateEnv();
  } catch (error) {
    console.error(`\n${error.message}\n`);
    process.exit(1);
  }

  await connectDB();

  console.log(
    `\nMigration « caisses annuelles » — mode ${
      APPLY ? "RÉEL (--apply)" : "SIMULATION (aucune écriture)"
    }\n`
  );

  const settingsList = await SocialFundSettings.find().sort({ church: 1 }).lean();

  if (settingsList.length === 0) {
    console.log(
      "  Aucune église n'a le module Service Social configuré : rien à migrer.\n"
    );

    await disconnectDB();

    return;
  }

  const thisYear = currentYear();

  for (const settings of settingsList) {
    const church = settings.church;

    console.log(`  Église ${church}`);

    // ---- 1. rattachement des mouvements ---------------------------
    const orphans = await SocialLedgerEntry.find({
      church,
      $or: [{ year: { $exists: false } }, { year: null }],
    })
      .select("createdAt amount")
      .lean();

    const perYear = new Map();

    for (const entry of orphans) {
      const year = exerciceYearOf(entry.createdAt);

      perYear.set(year, (perYear.get(year) ?? 0) + 1);
    }

    if (orphans.length === 0) {
      console.log("    mouvements : tous déjà rattachés à un exercice.");
    } else {
      for (const [year, count] of [...perYear].sort((a, b) => a[0] - b[0])) {
        console.log(`    mouvements : ${count} rattaché(s) à l'exercice ${year}.`);
      }

      if (APPLY) {
        // Une mise à jour par exercice plutôt qu'une par document :
        // quelques requêtes au lieu de plusieurs milliers.
        for (const year of perYear.keys()) {
          const start = new Date(Date.UTC(year, 0, 1));
          const end = new Date(Date.UTC(year + 1, 0, 1));

          const isFirstYear = year === SOCIAL_START_YEAR;

          await SocialLedgerEntry.updateMany(
            {
              church,
              $or: [{ year: { $exists: false } }, { year: null }],
              // Le premier exercice absorbe aussi tout mouvement
              // antérieur à 2024 (cf. `exerciceYearOf`).
              createdAt: isFirstYear ? { $lt: end } : { $gte: start, $lt: end },
            },
            { $set: { year } }
          );
        }
      }
    }

    // ---- 2 & 3. exercices, report et clôture ----------------------
    // Le solde d'ouverture 2024 reprend l'ancien solde initial de
    // l'église : c'est la trésorerie d'avant-système, elle ne doit pas
    // disparaître dans la bascule.
    let opening = settings.openingBalance || 0;

    for (let year = SOCIAL_START_YEAR; year <= thisYear; year += 1) {
      const existing = await SocialFundYear.findOne({ church, year }).lean();

      // Somme des mouvements de l'exercice, en tenant compte du
      // rattachement qui vient (ou non) d'être appliqué.
      const [aggregate] = await SocialLedgerEntry.aggregate([
        {
          $match: APPLY
            ? { church, year }
            : {
                church,
                createdAt:
                  year === SOCIAL_START_YEAR
                    ? { $lt: new Date(Date.UTC(year + 1, 0, 1)) }
                    : {
                        $gte: new Date(Date.UTC(year, 0, 1)),
                        $lt: new Date(Date.UTC(year + 1, 0, 1)),
                      },
              },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);

      const movements = aggregate?.total ?? 0;
      const closing = (existing?.openingBalance ?? opening) + movements;
      const isPast = year < thisYear;

      if (existing) {
        console.log(
          `    exercice ${year} : déjà présent (${existing.status}), ouverture ${money(
            existing.openingBalance
          )} — inchangé.`
        );
      } else {
        console.log(
          `    exercice ${year} : ouverture ${money(opening)}, mouvements ${money(
            movements
          )}, clôture ${money(closing)}${isPast ? " → clôturé" : " → ouvert"}.`
        );

        if (APPLY) {
          await SocialFundYear.create({
            church,
            year,
            openingBalance: opening,
            ...(isPast
              ? {
                  status: "cloture",
                  closingBalance: closing,
                  closedAt: new Date(),
                }
              : { status: "ouvert" }),
          });
        }
      }

      // Report vers l'exercice suivant, qu'on vienne de le créer ou
      // qu'il existait déjà.
      opening = closing;
    }

    console.log("");
  }

  if (!APPLY) {
    console.log(
      "  SIMULATION : rien n'a été écrit. Relancez avec --apply pour appliquer.\n"
    );
  } else {
    console.log("  Migration appliquée.\n");
  }

  await disconnectDB();
};

run().catch(async (error) => {
  console.error("\nÉchec de la migration :", error.message, "\n");

  await disconnectDB().catch(() => {});

  process.exit(1);
});
