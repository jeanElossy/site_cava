import mongoose from "mongoose";

import { env, validateEnv } from "../config/env.js";
import Flock from "../models/Flock.js";

// Crée les bergeries de la liste officielle « Bergerie / Attribut de
// Dieu » qui n'apparaissaient dans AUCUN matricule des 44 premiers
// membres — donc sans code existant à renommer (voir
// rename-flocks.js). Ce sont des bergeries nouvellement créées,
// destinées à accueillir les prochains membres inscrits.
//
// Idempotent : upsert par (église, code), rejouable sans risque.
//
// Usage : node src/scripts/create-new-flocks.js

const CHURCH = 1;

const NEW_FLOCKS = [
  { code: "SA", name: "Yahvé Sabaoth" },
  { code: "GI", name: "El Gibbor" },
];

const run = async () => {
  validateEnv();

  await mongoose.connect(env.MONGODB_URI);

  for (const flock of NEW_FLOCKS) {
    const result = await Flock.findOneAndUpdate(
      { church: CHURCH, code: flock.code },
      { $setOnInsert: { name: flock.name, status: "published" } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`  ✓ ${result.code} — ${result.name}`);
  }

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(`\n[creation bergeries] ÉCHEC : ${error.message}\n`);

  await mongoose.disconnect().catch(() => {});

  process.exit(1);
});
