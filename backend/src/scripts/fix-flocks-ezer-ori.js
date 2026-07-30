import mongoose from "mongoose";

import { env, validateEnv } from "../config/env.js";
import Flock from "../models/Flock.js";
import Member from "../models/Member.js";

// Corrige deux erreurs identifiées après les scripts rename-flocks.js
// et create-new-flocks.js :
//
//  1. CH="Chama" était un nom incomplet : le nom officiel est
//     "El Chama".
//  2. GI="El Gibbor" (créée par create-new-flocks.js) et le projet
//     jamais concrétisé "Yahvé Shalom" (jamais créé en base) sont
//     remplacés par deux bergeries neuves de la liste officielle :
//     EZ="Yahvé Ézer" et OR="Yahvé Ori".
//
// GI n'ayant AUCUN membre rattaché (vérifié avant écriture ci-dessous),
// le document existant est renommé en place plutôt que supprimé puis
// recréé : cela conserve son ObjectId, au cas où quelque chose y
// référerait déjà. OR n'existait pas avant : simple upsert.
//
// Usage : node src/scripts/fix-flocks-ezer-ori.js

const CHURCH = 1;

const run = async () => {
  validateEnv();

  await mongoose.connect(env.MONGODB_URI);

  console.log("\n[fix-flocks-ezer-ori] Vérifications préalables…\n");

  // --- 1. GI doit exister et n'avoir aucun membre rattaché ----------
  const giFlock = await Flock.findOne({ church: CHURCH, code: "GI" });

  if (!giFlock) {
    throw new Error(
      "Bergerie GI introuvable pour l'église 1 — rien à renommer. Abandon."
    );
  }

  const giMemberCount = await Member.countDocuments({ flock: giFlock._id });

  if (giMemberCount !== 0) {
    throw new Error(
      `La bergerie GI (« ${giFlock.name} ») a ${giMemberCount} membre(s) rattaché(s). ` +
        "Renommer ce document écraserait des données réelles. Abandon volontaire — " +
        "aucune écriture n'a été effectuée."
    );
  }

  console.log(
    `  ✓ GI (« ${giFlock.name} », id ${giFlock._id}) confirmée sans membre — renommage sûr.`
  );

  const chFlockBefore = await Flock.findOne({ church: CHURCH, code: "CH" });

  console.log(
    chFlockBefore
      ? `  ✓ CH (« ${chFlockBefore.name} ») trouvée — sera renommée en « El Chama ».`
      : "  ⨯ CH introuvable — le renommage sera ignoré."
  );

  console.log("\n[fix-flocks-ezer-ori] Écritures…\n");

  // --- 2. Renommer GI → EZ = "Yahvé Ézer" ----------------------------
  const ezFlock = await Flock.findOneAndUpdate(
    { _id: giFlock._id },
    { code: "EZ", name: "Yahvé Ézer" },
    { new: true, runValidators: true }
  );

  console.log(`  ✓ ${giFlock.code} → ${ezFlock.code} — ${ezFlock.name}`);

  // --- 3. Upsert OR = "Yahvé Ori" ------------------------------------
  const orFlock = await Flock.findOneAndUpdate(
    { church: CHURCH, code: "OR" },
    { $setOnInsert: { name: "Yahvé Ori", status: "published" } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log(`  ✓ ${orFlock.code} — ${orFlock.name}`);

  // --- 4. Corriger le nom de CH ---------------------------------------
  const chFlockAfter = await Flock.findOneAndUpdate(
    { church: CHURCH, code: "CH" },
    { name: "El Chama" },
    { new: true, runValidators: true }
  );

  if (chFlockAfter) {
    console.log(`  ✓ CH — ${chFlockAfter.name}`);
  } else {
    console.log("  ⨯ CH — bergerie introuvable, ignoré");
  }

  // --- 5. Résumé final, pour audit -----------------------------------
  console.log("\n[fix-flocks-ezer-ori] Résumé\n");

  console.log("  Avant :");
  console.log(`    GI — ${giFlock.name} (${giMemberCount} membre)`);
  console.log(`    CH — ${chFlockBefore ? chFlockBefore.name : "(introuvable)"}`);
  console.log(`    OR — (inexistante)`);

  console.log("\n  Après :");
  console.log(`    EZ — ${ezFlock.name}`);
  console.log(`    OR — ${orFlock.name}`);
  console.log(`    CH — ${chFlockAfter ? chFlockAfter.name : "(introuvable)"}`);

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(`\n[fix-flocks-ezer-ori] ÉCHEC : ${error.message}\n`);

  await mongoose.disconnect().catch(() => {});

  process.exit(1);
});
