import "dotenv/config";

import { validateEnv } from "../config/env.js";
import { connectDB, disconnectDB } from "../config/db.js";
import Attendance from "../models/Attendance.js";

// Supprime l'ancien index unique sur `{ "visitor.badgeCode", securityQr }`.
//
// POURQUOI CE SCRIPT EXISTE
// Un badge invité est un jeton RÉUTILISABLE : à l'entrée, on le scanne,
// on laisse l'invité entrer, on reprend le badge pour le suivant.
// Chaque scan est donc un invité de plus. L'index unique posé au départ
// (par symétrie erronée avec la carte de membre) faisait répondre
// « déjà enregistrée » au deuxième invité muni du même badge, qui
// n'était alors compté nulle part.
//
// L'index a été retiré du schéma (voir Attendance.js), mais Mongoose ne
// SUPPRIME jamais de la base un index enlevé du schéma : il faut le
// faire explicitement, sinon la contrainte reste active en production
// et le deuxième scan lève une erreur de clé dupliquée (code 11000)
// désormais non rattrapée — soit un 500 renvoyé à l'agent en pleine
// entrée de culte.
//
// Idempotent : si l'index n'existe pas (déjà supprimé, ou base neuve),
// le script le signale et ne fait rien. N'écrit rien par défaut —
// ajouter `--apply` pour exécuter.
//
//   node src/scripts/dropGuestBadgeUniqueIndex.js          (plan)
//   node src/scripts/dropGuestBadgeUniqueIndex.js --apply  (exécution)

const APPLY = process.argv.includes("--apply");

// Nom Mongo par défaut de l'index composé, dérivé de ses champs.
const INDEX_NAME = "visitor.badgeCode_1_securityQr_1";

const run = async () => {
  validateEnv();
  await connectDB();

  const collection = Attendance.collection;
  const indexes = await collection.indexes();
  const target = indexes.find((index) => index.name === INDEX_NAME);

  if (!target) {
    console.log(
      `✓ L'index « ${INDEX_NAME} » n'existe pas (déjà supprimé ou base neuve). Rien à faire.`
    );
    await disconnectDB();
    return;
  }

  console.log(`Index trouvé : ${INDEX_NAME}`);
  console.log(`  unique            : ${Boolean(target.unique)}`);
  console.log(`  partialFilter     : ${JSON.stringify(target.partialFilterExpression ?? null)}`);

  if (!APPLY) {
    console.log(
      "\n(plan) Ajoutez --apply pour supprimer réellement cet index.\n" +
        "Sans suppression, le deuxième scan d'un même badge invité échouera en production."
    );
    await disconnectDB();
    return;
  }

  await collection.dropIndex(INDEX_NAME);
  console.log(`\n✓ Index « ${INDEX_NAME} » supprimé. Un badge invité peut désormais être scanné autant de fois qu'il y a d'invités.`);

  await disconnectDB();
};

run().catch(async (error) => {
  console.error("Échec du script :", error.message);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
