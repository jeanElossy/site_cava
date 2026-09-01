import mongoose from "mongoose";

import { env, validateEnv } from "../config/env.js";
import Child from "../models/Child.js";
import SundaySchoolClass from "../models/SundaySchoolClass.js";
import { nextChildFileNumber } from "../services/childNumber.service.js";

// Reprise du registre papier de l'École du dimanche.
//
// ------------------------------------------------------------------
// N'ÉCRIT RIEN SANS `--apply`
// ------------------------------------------------------------------
// Convention de tous les scripts de reprise du dépôt : sans le
// drapeau, le script affiche son plan et s'arrête. Idempotent : un
// enfant déjà présent (même nom, même prénom, même église) est ignoré,
// jamais dupliqué.
//
//   node src/scripts/seed-children-registry.js           (plan)
//   node src/scripts/seed-children-registry.js --apply   (écriture)
//
// ------------------------------------------------------------------
// LES CLASSES SONT CELLES DU REGISTRE, PAS CELLES DES MAQUETTES
// ------------------------------------------------------------------
// Le registre porte trois classes — 03 à 05, 06 à 08, 09 à 12 ans.
// Les maquettes en montraient quatre (dont des « pré-ados 12-14 » qui
// n'existent pas). Ce sont les classes réelles qui font foi ; une
// quatrième s'ajoutera depuis l'administration le jour où elle
// ouvrira, sans développeur.
//
// ------------------------------------------------------------------
// CE QUE LE REGISTRE NE DIT PAS
// ------------------------------------------------------------------
// Ni date de naissance, ni sexe, ni responsables. Ces champs restent
// donc VIDES : les deviner à partir des prénoms produirait des données
// fausses présentées comme sûres — un « Chance » ou un « Bénie » ne
// tranchent rien. `Child.source = "registre"` et le virtuel
// `missingFields` permettent à l'équipe de retrouver ces dossiers et
// de les compléter (filtre « À compléter uniquement » dans la liste).
//
// ------------------------------------------------------------------
// LES QUATRE DOUBLONS DU REGISTRE
// ------------------------------------------------------------------
// Quatre enfants figurent sur deux feuilles à la fois :
//
//   ADJAFFI Jean David    ┐
//   LIADE Abdullam        ├─ sur « 06 à 08 » ET sur « 03 à 05 »
//   LIADE Rehoboth Isaac  ┘
//   KOUASSI Affout Nael   ── deux fois sur « 03 à 05 »
//
// Le dernier cas est simple : deux feuilles de la même classe, donc un
// seul enfant, une seule fiche.
//
// Les trois autres sont ambigus. Ils sont rattachés à la classe la
// PLUS ÂGÉE (06 à 08), pour une raison précise : la feuille « 06 à
// 08 » ne contient qu'eux trois, ce qui ressemble à une promotion
// récente — un enfant passe d'une classe à la suivante, jamais
// l'inverse. Le choix est INSCRIT DANS LEURS NOTES : il se corrige
// d'un clic depuis l'administration, et l'équipe sait pourquoi il a
// été fait.
const CLASSES = [
  {
    name: "03 à 05 ans",
    ageMin: 3,
    ageMax: 5,
    icon: "🧸",
    description: "Les tout-petits.",
  },
  {
    name: "06 à 08 ans",
    ageMin: 6,
    ageMax: 8,
    icon: "🎨",
    description: "Enfants de 6 à 8 ans.",
  },
  {
    name: "09 à 12 ans",
    ageMin: 9,
    ageMax: 12,
    icon: "📖",
    description: "Enfants de 9 à 12 ans.",
  },
];

// Noms saisis À LA MAIN plutôt que découpés par un parseur : le
// registre mêle des noms composés (« VOUEBOU-lou »), une apostrophe
// (« N'SA ») et des prénoms multiples (« Amoen Marie Emanuella »).
// Vingt-cinq lignes se relisent ; un parseur se tromperait en silence.
const AMBIGUOUS_NOTE =
  "Registre papier : figurait à la fois sur la feuille « 06 à 08 ans » et sur " +
  "« 03 à 05 ans ». Rattaché ici à la classe la plus âgée (la feuille 06-08 ne " +
  "contenait que ces trois enfants, ce qui évoque une promotion récente). " +
  "À confirmer auprès du responsable.";

const CHILDREN = [
  // ---- 09 à 12 ans (feuille 1) ----
  { lastName: "ADJAFFI", firstName: "Chance.A", className: "09 à 12 ans" },
  { lastName: "DOLE", firstName: "Marie-Ange", className: "09 à 12 ans" },
  { lastName: "LIADE", firstName: "Jean Samuel", className: "09 à 12 ans" },
  { lastName: "LIADE", firstName: "Rivka", className: "09 à 12 ans" },
  { lastName: "LIADE", firstName: "Tabitha Zoé", className: "09 à 12 ans" },
  { lastName: "OUANDJI", firstName: "Christ Alvin", className: "09 à 12 ans" },
  { lastName: "VOUEBOU-LOU", firstName: "Bénie .V", className: "09 à 12 ans" },
  { lastName: "ZADI", firstName: "Devon Samuel", className: "09 à 12 ans" },
  { lastName: "ZADI", firstName: "Kahyra Yaëlle", className: "09 à 12 ans" },

  // ---- 06 à 08 ans (feuille 2) — les trois cas ambigus ----
  {
    lastName: "ADJAFFI",
    firstName: "Jean David",
    className: "06 à 08 ans",
    notes: AMBIGUOUS_NOTE,
  },
  {
    lastName: "LIADE",
    firstName: "Abdullam",
    className: "06 à 08 ans",
    notes: AMBIGUOUS_NOTE,
  },
  {
    lastName: "LIADE",
    firstName: "Rehoboth Isaac",
    className: "06 à 08 ans",
    notes: AMBIGUOUS_NOTE,
  },

  // ---- 03 à 05 ans (feuilles 3 et 4, fusionnées) ----
  //
  // Les trois enfants ci-dessus figuraient aussi sur la feuille 3 :
  // ils ne sont pas répétés ici. KOUASSI Affout Nael figurait sur les
  // deux feuilles 03-05 : une seule fiche.
  {
    lastName: "AMALAMAN",
    firstName: "Amoen Marie Emanuella",
    className: "03 à 05 ans",
  },
  { lastName: "AMALAMAN", firstName: "Amoen Prunelle", className: "03 à 05 ans" },
  { lastName: "DIARRASOUBA", firstName: "Noura", className: "03 à 05 ans" },
  {
    lastName: "KOUASSI",
    firstName: "Affout Nael",
    className: "03 à 05 ans",
    notes:
      "Registre papier : figurait sur les deux feuilles « 03 à 05 ans ». Une seule fiche.",
  },
  { lastName: "LIADE", firstName: "Jean Vicky", className: "03 à 05 ans" },
  { lastName: "N'SA", firstName: "Ezechiel Junior", className: "03 à 05 ans" },
  { lastName: "VOUEBOU", firstName: "Boaz .Emmanuel", className: "03 à 05 ans" },
  { lastName: "YE", firstName: "Guelanon Exaucé", className: "03 à 05 ans" },
  { lastName: "ZADI", firstName: "Liam Moïse", className: "03 à 05 ans" },
  { lastName: "ZADI", firstName: "Rendall", className: "03 à 05 ans" },
  { lastName: "ADJAFFI", firstName: "Jireh Yannis", className: "03 à 05 ans" },
  { lastName: "LIADE", firstName: "Berakah", className: "03 à 05 ans" },
  { lastName: "YE", firstName: "Guelasson karelle", className: "03 à 05 ans" },
];

// Une seule église pour le moment (voir CLAUDE.md) : l'église 1 est la
// seule réelle, les 2 à 5 sont des bacs à sable de test.
const CHURCH = 1;

const run = async () => {
  const apply = process.argv.includes("--apply");

  validateEnv();

  await mongoose.connect(env.MONGODB_URI);

  console.log(
    apply
      ? "\n=== IMPORT DU REGISTRE — ÉCRITURE ===\n"
      : "\n=== IMPORT DU REGISTRE — PLAN (aucune écriture) ===\n" +
          "    Relancez avec --apply pour exécuter.\n"
  );

  // ---- Classes ----
  const classIdByName = {};

  for (const entry of CLASSES) {
    const existing = await SundaySchoolClass.findOne({
      church: CHURCH,
      name: entry.name,
    });

    if (existing) {
      classIdByName[entry.name] = existing._id;

      console.log(`  = classe « ${entry.name} » — déjà en base`);

      continue;
    }

    if (!apply) {
      console.log(`  + classe « ${entry.name} » (${entry.ageMin}–${entry.ageMax} ans)`);

      continue;
    }

    const created = await SundaySchoolClass.create({
      ...entry,
      church: CHURCH,
      usualDay: "dimanche",
      status: "published",
    });

    classIdByName[entry.name] = created._id;

    console.log(`  + classe « ${entry.name} » créée`);
  }

  // ---- Enfants ----
  let created = 0;
  let skipped = 0;

  for (const entry of CHILDREN) {
    // Idempotence : même nom, même prénom, même église. Le numéro de
    // dossier ne peut pas servir de clé — il est attribué par le
    // compteur, donc inconnu avant la création.
    const existing = await Child.findOne({
      church: CHURCH,
      lastName: entry.lastName,
      firstName: entry.firstName,
    });

    if (existing) {
      console.log(
        `  = ${entry.lastName} ${entry.firstName} — déjà en base (${existing.fileNumber})`
      );

      skipped += 1;

      continue;
    }

    if (!apply) {
      console.log(
        `  + ${entry.lastName} ${entry.firstName} → ${entry.className}` +
          (entry.notes ? "  ⚠ note ajoutée" : "")
      );

      created += 1;

      continue;
    }

    const { fileNumber } = await nextChildFileNumber();

    await Child.create({
      fileNumber,
      lastName: entry.lastName,
      firstName: entry.firstName,
      church: CHURCH,
      currentClass: classIdByName[entry.className],
      classAssignedAt: new Date(),
      status: "actif",
      // Marque la provenance : c'est ce qui permet de retrouver les
      // dossiers à compléter (date de naissance, sexe, responsables).
      source: "registre",
      ...(entry.notes ? { notes: entry.notes } : {}),
    });

    console.log(
      `  + ${fileNumber}  ${entry.lastName} ${entry.firstName} → ${entry.className}`
    );

    created += 1;
  }

  console.log(
    `\n  ${created} enfant(s) ${apply ? "créé(s)" : "à créer"}, ${skipped} déjà en base.`
  );

  if (created > 0) {
    console.log(
      "\n  ⚠ Ces fiches n'ont ni date de naissance, ni sexe, ni responsable :\n" +
        "    le registre papier ne les porte pas. Elles apparaissent dans\n" +
        "    /admin/enfants/liste avec le filtre « À compléter uniquement ».\n"
    );
  }

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("\nÉchec de l'import :", error.message, "\n");

  await mongoose.disconnect();

  process.exit(1);
});
