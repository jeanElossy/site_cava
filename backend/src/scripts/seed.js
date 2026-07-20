import { env, validateEnv } from "../config/env.js";
import { connectDB, disconnectDB } from "../config/db.js";

import User from "../models/User.js";
import Event from "../models/Event.js";
import Ministry from "../models/Ministry.js";
import Media from "../models/Media.js";
import Settings from "../models/Settings.js";

import {
  seedEvents,
  seedMinistries,
  seedMedias,
} from "./seed-data.js";

// Amorçage de la base.
//
// IDEMPOTENT : chaque entrée est identifiée par une clé métier (slug,
// e-mail, titre+catégorie) et mise à jour plutôt que dupliquée. Le
// script peut donc être relancé sans crainte — y compris sur une base
// contenant déjà du contenu saisi depuis l'administration.
//
// Il ne SUPPRIME jamais rien.

const upsert = async (Model, key, docs, label) => {
  let created = 0;
  let updated = 0;

  for (const doc of docs) {
    const filter = Object.fromEntries(
      key.map((k) => [k, doc[k]])
    );

    const existing = await Model.findOne(filter).lean();

    if (existing) {
      // On ne réécrit pas ce que l'administration a pu modifier :
      // seuls les documents jamais touchés sont rafraîchis.
      updated += 1;

      continue;
    }

    await Model.create(doc);

    created += 1;
  }

  console.log(
    `  ${label.padEnd(12)} ${created} créé(s), ${updated} déjà présent(s)`
  );
};

const run = async () => {
  try {
    validateEnv({ requireSeedAdmin: true });
  } catch (error) {
    console.error(`\n${error.message}\n`);

    process.exit(1);
  }

  await connectDB();

  console.log("\nAmorçage de la base :\n");

  // ---- Administrateur ----------------------------------------
  const email = env.SEED_ADMIN_EMAIL.toLowerCase();

  const existingAdmin = await User.findByEmail(email);

  if (existingAdmin) {
    console.log(
      `  admin        déjà présent (${email}) — mot de passe inchangé`
    );
  } else {
    // Le hachage est fait par le hook `pre('save')` du modèle.
    await User.create({
      name: env.SEED_ADMIN_NAME ?? "Administrateur",
      email,
      password: env.SEED_ADMIN_PASSWORD,
      role: "admin",
    });

    console.log(`  admin        créé (${email})`);
  }

  // ---- Contenu -----------------------------------------------
  await upsert(Event, ["slug"], seedEvents, "événements");
  await upsert(
    Ministry,
    ["slug"],
    seedMinistries,
    "ministères"
  );
  await upsert(
    Media,
    ["title", "category"],
    seedMedias,
    "médias"
  );

  // ---- Paramètres --------------------------------------------
  await Settings.getSite();

  console.log("  paramètres   document unique prêt");

  console.log("\nTerminé.\n");

  await disconnectDB();
};

run().catch(async (error) => {
  console.error("\nÉchec de l'amorçage :", error.message, "\n");

  await disconnectDB().catch(() => {});

  process.exit(1);
});
