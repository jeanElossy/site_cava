import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import mongoose from "mongoose";

import { env, validateEnv } from "../config/env.js";
import Ministry from "../models/Ministry.js";

// Restauration du contenu détaillé des ministères.
//
// ------------------------------------------------------------------
// POURQUOI CE SCRIPT
// ------------------------------------------------------------------
// Avant le passage en base, chaque ministère portait dans le code un
// contenu riche : statistiques, responsables, témoignages, mission et
// vision. L'amorçage initial n'a repris que les champs de base, si
// bien que les pages de détail affichaient « Aucune statistique ».
//
// Ce contenu n'était pas perdu : il subsistait dans l'historique Git.
// Il est ici réinjecté, après adaptation au schéma actuel — l'ancien
// format nommait `description` ce que le modèle appelle `bio`, et
// `message` ce qu'il appelle `quote`.
//
// ------------------------------------------------------------------
// RÈGLE : NE JAMAIS ÉCRASER
// ------------------------------------------------------------------
// Un champ déjà rempli en base est laissé intact. Si l'administration
// a saisi ses propres statistiques depuis, ce script ne doit pas les
// remplacer par d'anciennes valeurs. Il ne comble que les vides, ce
// qui le rend rejouable sans risque.
//
// Usage : npm run restore:ministeres

const HERE = dirname(fileURLToPath(import.meta.url));

const isEmpty = (value) =>
  value === undefined ||
  value === null ||
  (Array.isArray(value) && value.length === 0) ||
  (typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0);

const run = async () => {
  validateEnv();

  await mongoose.connect(env.MONGODB_URI);

  const content = JSON.parse(
    await readFile(resolve(HERE, "ministries-content.json"), "utf8")
  );

  let updated = 0;
  let skipped = 0;
  let missing = 0;

  for (const [slug, data] of Object.entries(content)) {
    const ministry = await Ministry.findOne({ slug });

    if (!ministry) {
      console.log(`  ⨯ ${slug} — absent de la base, ignoré`);

      missing += 1;

      continue;
    }

    const filled = [];

    for (const field of [
      "stats",
      "leaders",
      "testimonials",
      "mission",
      "vision",
    ]) {
      if (isEmpty(ministry[field]) && !isEmpty(data[field])) {
        ministry[field] = data[field];

        filled.push(field);
      }
    }

    if (filled.length === 0) {
      console.log(`  = ${slug} — déjà complet, rien à faire`);

      skipped += 1;

      continue;
    }

    await ministry.save();

    console.log(`  ✓ ${slug} — ${filled.join(", ")}`);

    updated += 1;
  }

  console.log(
    `\n  ${updated} mis à jour, ${skipped} inchangés, ${missing} introuvables`
  );

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(`\n[restauration] ÉCHEC : ${error.message}\n`);

  await mongoose.disconnect().catch(() => {});

  process.exit(1);
});
