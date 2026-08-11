import { validateEnv } from "../config/env.js";
import { connectDB, disconnectDB } from "../config/db.js";

import SocialContribution from "../models/SocialContribution.js";
import SocialLedgerEntry from "../models/SocialLedgerEntry.js";

// Vide la page « Cotisations sociales » (admin) à la demande du client
// : le module vient d'être déployé et les lignes déjà générées par le
// job mensuel ne sont pas exploitables en l'état (membres sans
// matricule/nom, églises sans fiche). Supprime TOUTES les
// SocialContribution ainsi que les SocialLedgerEntry de type
// "cotisation" qu'elles ont générées, pour que le solde de caisse
// reste cohérent avec la liste vidée.
//
// Volontairement épargnés : SocialFundSettings (la génération
// mensuelle automatique doit continuer normalement ensuite),
// SocialAid / SocialAidType et les SocialLedgerEntry de type "aide" /
// "aide_annulation" (Phase 2, non concernée par cette demande).
//
// Nécessite --confirm pour éviter une exécution accidentelle.
//
// Usage : node backend/src/scripts/clearSocialContributions.js --confirm

const run = async () => {
  if (!process.argv.includes("--confirm")) {
    console.error(
      "\nCe script supprime TOUTES les cotisations sociales et les écritures de caisse liées.\n" +
        "Relancez avec --confirm pour l'exécuter réellement.\n"
    );

    process.exit(1);
  }

  try {
    validateEnv();
  } catch (error) {
    console.error(`\n${error.message}\n`);

    process.exit(1);
  }

  await connectDB();

  const contributionsCount = await SocialContribution.countDocuments();
  const ledgerCount = await SocialLedgerEntry.countDocuments({ type: "cotisation" });

  console.log(
    `\n${contributionsCount} cotisation(s) et ${ledgerCount} écriture(s) de caisse "cotisation" vont être supprimées.\n`
  );

  await SocialContribution.deleteMany({});
  await SocialLedgerEntry.deleteMany({ type: "cotisation" });

  console.log("Terminé.\n");

  await disconnectDB();
};

run().catch(async (error) => {
  console.error("\nÉchec du nettoyage :", error.message, "\n");

  await disconnectDB().catch(() => {});

  process.exit(1);
});
