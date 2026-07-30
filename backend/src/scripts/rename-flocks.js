import mongoose from "mongoose";

import { env, validateEnv } from "../config/env.js";
import Flock from "../models/Flock.js";

// Renomme les bergeries de l'église 1 avec leur vrai nom (« Bergerie
// / Attribut de Dieu »), fourni par l'utilisateur.
//
// Couvre les correspondances entre les codes déjà en base (déduits du
// registre papier des 44 premiers membres) et les noms officiels : le
// code reprend en général les deux premières lettres du mot distinctif
// du nom, comme "OL" pour "El Olam" (confirmé par l'utilisateur dès la
// conception). SH et CH étaient ambigus (plusieurs noms commencent par
// "Sh", aucun ne correspondait clairement à "CH") et ont été tranchés
// directement par l'utilisateur plutôt que devinés.
//
// PS et MP restent inchangés : ce sont des marqueurs de fonction
// (Pasteur, Maman Pasteur) dans le registre d'origine, pas des
// bergeries au sens de cette liste.
//
// Usage : node src/scripts/rename-flocks.js

const CHURCH = 1;

const RENAMES = [
  { code: "ME", name: "Yahvé Meccadeshem" },
  { code: "RA", name: "Yahvé Rapha" },
  { code: "TS", name: "Yahvé Tsidkenu" },
  { code: "JI", name: "Yahvé Jireh" },
  { code: "OL", name: "El Olam" },
  { code: "NI", name: "Yahvé Nissi" },
  { code: "RO", name: "Yahvé Rohi" },
  { code: "EL", name: "El Elyon" },
  { code: "SH", name: "El Shaddaï" },
  { code: "CH", name: "Chama" },
];

const run = async () => {
  validateEnv();

  await mongoose.connect(env.MONGODB_URI);

  let updated = 0;

  for (const { code, name } of RENAMES) {
    const result = await Flock.findOneAndUpdate(
      { church: CHURCH, code },
      { name },
      { new: true }
    );

    if (result) {
      console.log(`  ✓ ${code} — ${name}`);

      updated += 1;
    } else {
      console.log(`  ⨯ ${code} — bergerie introuvable, ignoré`);
    }
  }

  console.log(`\n  ${updated}/${RENAMES.length} bergeries renommées.`);

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(`\n[renommage bergeries] ÉCHEC : ${error.message}\n`);

  await mongoose.disconnect().catch(() => {});

  process.exit(1);
});
