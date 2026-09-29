import "dotenv/config";

import fs from "node:fs/promises";
import path from "node:path";

import { validateEnv } from "../config/env.js";
import { connectDB, disconnectDB } from "../config/db.js";

import {
  buildIncompleteProfilesPdf,
  buildSkillsDirectoryPdf,
} from "../services/memberExport.service.js";

// Écrit sur le disque les deux listes de travail tirées de l'annuaire :
//
//   1. fiches-a-completer-cava.pdf — les membres ACTIFS dont la fiche
//      est incomplète, avec, pour chacun, la liste nominative des
//      champs restés vides. C'est la liste d'appels : on sait qui
//      joindre et quoi lui demander.
//
//   2. competences-membres-cava.pdf — TOUS les membres actifs avec
//      leur profession et leurs compétences déclarées, dans l'ordre du
//      registre. C'est la matière de l'appel à candidature des
//      départements.
//
// Les deux documents sont aussi téléchargeables depuis
// /admin/communaute (boutons « Fiches à compléter » et
// « Compétences ») : ce script sert à les produire sans passer par
// l'interface, par exemple pour les imprimer avant un déploiement.
//
// LECTURE SEULE côté base : contrairement aux scripts de reprise de
// données voisins, il n'écrit rien dans MongoDB, donc pas de `--apply`
// à prévoir. Il écrit en revanche deux fichiers sur le disque.
//
// Usage :
//   node backend/src/scripts/exportMemberPdfs.js
//   node backend/src/scripts/exportMemberPdfs.js --out ./exports
//   node backend/src/scripts/exportMemberPdfs.js --eglise 1

const argValue = (name) => {
  const index = process.argv.indexOf(name);

  return index === -1 ? undefined : process.argv[index + 1];
};

const OUT_DIR = argValue("--out") ?? "exports";
const CHURCH = argValue("--eglise");

const run = async () => {
  try {
    validateEnv();
  } catch (error) {
    console.error(`\n${error.message}\n`);
    process.exit(1);
  }

  await connectDB();

  const filter = CHURCH ? { church: CHURCH } : {};

  console.log(
    `\nExport des listes de travail — ${
      CHURCH ? `église ${CHURCH}` : "toutes les églises"
    }\n`
  );

  const targets = [
    {
      file: "fiches-a-completer-cava.pdf",
      label: "Fiches à compléter (liste de relance)",
      build: buildIncompleteProfilesPdf,
    },
    {
      file: "competences-membres-cava.pdf",
      label: "Annuaire des compétences",
      build: buildSkillsDirectoryPdf,
    },
  ];

  await fs.mkdir(OUT_DIR, { recursive: true });

  for (const target of targets) {
    const buffer = await target.build(filter);
    const destination = path.resolve(OUT_DIR, target.file);

    await fs.writeFile(destination, buffer);

    console.log(
      `  ✓ ${target.label}\n    ${destination} (${Math.round(
        buffer.length / 1024
      )} Ko)`
    );
  }

  console.log("");

  await disconnectDB();
};

run().catch(async (error) => {
  console.error(error);

  await disconnectDB().catch(() => {});

  process.exit(1);
});
