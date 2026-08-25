import { validateEnv } from "../config/env.js";
import { connectDB, disconnectDB } from "../config/db.js";

import { generateDueContributions } from "../services/socialContribution.service.js";

// Rattrapage manuel des cotisations sociales dues — permet de ne pas
// attendre le premier passage du job planifié
// (socialContributionsGenerator.js) après un déploiement.
//
// Couvre tous les mois depuis 2026 (SOCIAL_START_YEAR), pas seulement
// le mois courant : c'est ce qui reconstitue les arriérés de chaque
// membre.
//
// IDEMPOTENT par construction : reprend exactement la même fonction
// que le job, protégée par l'index unique {member,year,month} du
// modèle SocialContribution. Peut être relancé sans risque.
//
// Usage : node backend/src/scripts/backfillSocialContributions.js

const run = async () => {
  try {
    validateEnv();
  } catch (error) {
    console.error(`\n${error.message}\n`);

    process.exit(1);
  }

  await connectDB();

  console.log("\nGénération des cotisations sociales dues (depuis 2026) :\n");

  const created = await generateDueContributions();

  console.log(`  ${created} ligne(s) de cotisation créée(s).\n`);

  await disconnectDB();
};

run().catch(async (error) => {
  console.error("\nÉchec du backfill :", error.message, "\n");

  await disconnectDB().catch(() => {});

  process.exit(1);
});
