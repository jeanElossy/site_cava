import { validateEnv } from "../config/env.js";
import { connectDB, disconnectDB } from "../config/db.js";

import User from "../models/User.js";
import Member from "../models/Member.js";

// Nettoie les résidus laissés par une exécution interrompue de
// agent.service.test.js / agents.routes.test.js : ces deux fichiers
// réutilisent tous les deux le préfixe de matricule "5ZZ99" (église 5,
// bergerie fictive "ZZ", année "99" — improbable en production réelle,
// voir les commentaires de tête de ces deux fichiers). Une exécution
// interrompue de `npm test` (voir l'avertissement de CLAUDE.md) laisse
// ces comptes en base ; comme le compteur de matricule de test
// redémarre à 1 à chaque exécution, la fois suivante entre en conflit
// dessus ("Un compte existe déjà avec ce matricule").
//
// Nécessite --confirm pour éviter une exécution accidentelle.
//
// Usage : node backend/src/scripts/cleanupAgentTestFixtures.js --confirm

const run = async () => {
  const confirm = process.argv.includes("--confirm");

  try {
    validateEnv();
  } catch (error) {
    console.error(`\n${error.message}\n`);

    process.exit(1);
  }

  await connectDB();

  const userFilter = { registrationNumber: { $regex: /^5ZZ99/ } };
  const memberFilter = { registrationNumber: { $regex: /^5ZZ99/ } };

  const users = await User.find(userFilter, "registrationNumber name").lean();
  const members = await Member.find(memberFilter, "registrationNumber firstName lastName").lean();

  console.log(`\n${users.length} compte(s) utilisateur et ${members.length} fiche(s) membre à supprimer.\n`);

  users.forEach((user) => console.log(`  User  ${user.registrationNumber}  (${user.name})`));
  members.forEach((member) =>
    console.log(`  Member ${member.registrationNumber}  (${member.firstName} ${member.lastName})`)
  );

  if (!confirm) {
    console.log(
      "\nAucune modification effectuée (aperçu). Relancez avec --confirm pour appliquer.\n"
    );

    await disconnectDB();

    return;
  }

  await User.deleteMany(userFilter);
  await Member.deleteMany(memberFilter);

  console.log("\nNettoyage terminé.\n");

  await disconnectDB();
};

run().catch(async (error) => {
  console.error("\nÉchec du nettoyage :", error.message, "\n");

  await disconnectDB().catch(() => {});

  process.exit(1);
});
