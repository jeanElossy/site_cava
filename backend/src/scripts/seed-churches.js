import mongoose from "mongoose";

import { env, validateEnv } from "../config/env.js";
import Church from "../models/Church.js";

// Crée l'église existante du réseau CAVA.
//
// À ce jour, une seule église est réellement en activité. Les numéros
// 2 à 5 restent réservés par le format du matricule (voir
// registrationNumber.service.js) mais ne sont créés que lorsqu'une
// nouvelle église ouvre réellement — pas de placeholders fictifs.
//
// Idempotent : upsert par numéro, rejouable sans risque.
//
// Usage : node src/scripts/seed-churches.js

const CHURCHES = [{ number: 1, name: "Centre Apostolique Vie et Abondance (CAVA)" }];

const run = async () => {
  validateEnv();

  await mongoose.connect(env.MONGODB_URI);

  for (const church of CHURCHES) {
    const result = await Church.findOneAndUpdate(
      { number: church.number },
      { $setOnInsert: { name: church.name, status: "published" } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`  ✓ Église ${result.number} — ${result.name}`);
  }

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(`\n[creation eglises] ÉCHEC : ${error.message}\n`);

  await mongoose.disconnect().catch(() => {});

  process.exit(1);
});
