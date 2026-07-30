import mongoose from "mongoose";

import { env, validateEnv } from "../config/env.js";
import Flock from "../models/Flock.js";
import Member from "../models/Member.js";
import RegistrationCounter from "../models/RegistrationCounter.js";

// Import ponctuel des 44 premiers membres du registre papier existant.
//
// ------------------------------------------------------------------
// POURQUOI CE SCRIPT
// ------------------------------------------------------------------
// Ces membres possèdent déjà un matricule attribué à la main, avant
// la mise en place du système d'inscription en ligne. Ce script les
// enregistre tels quels, avec leur matricule d'origine, pour que le
// parcours « J'ai déjà un matricule » du formulaire public les
// reconnaisse dès leur première visite : leur soumission deviendra
// alors une mise à jour de fiche existante plutôt qu'une nouvelle
// inscription, et le compteur de l'église 1 ne redémarrera pas à 001.
//
// ------------------------------------------------------------------
// DEUX CORRECTIONS PAR RAPPORT AU REGISTRE PAPIER
// ------------------------------------------------------------------
// Repérées lors de la conception du système (voir le document de
// design) :
//   - ligne 015 (LIADE Jocelyne) : le chiffre d'église manquait sur le
//     registre ("JI 19-015 O" au lieu de "1JI 19-015 O").
//   - ligne 044 (WAYOU Laura) : le numéro était dupliqué avec la
//     ligne 043 ("1ME 23-043 R" au lieu de "1ME 23-044 R" — la lettre
//     R était déjà correcte pour le rang 44, seul le numéro était faux).
//
// ------------------------------------------------------------------
// NOMS DE BERGERIE
// ------------------------------------------------------------------
// Seul le nom réel de "OL" (El Olam) est connu avec certitude. Les
// autres codes sont créés avec un nom provisoire explicite, à corriger
// depuis l'onglet Bergeries de l'administration.
//
// ------------------------------------------------------------------
// RÈGLE : REJOUABLE SANS RISQUE
// ------------------------------------------------------------------
// Chaque bergerie et chaque membre est écrit via un upsert sur une clé
// stable (code+église pour une bergerie, matricule pour un membre) :
// relancer ce script ne crée jamais de doublon.
//
// Usage : node src/scripts/seed-legacy-members.js

const FLOCKS = [
  { code: "PS", name: "Pasteur" },
  { code: "MP", name: "Maman Pasteur" },
  { code: "EL", name: "Bergerie EL (nom à confirmer)" },
  { code: "ME", name: "Bergerie ME (nom à confirmer)" },
  { code: "OL", name: "El Olam" },
  { code: "SH", name: "Bergerie SH (nom à confirmer)" },
  { code: "RO", name: "Bergerie RO (nom à confirmer)" },
  { code: "CH", name: "Bergerie CH (nom à confirmer)" },
  { code: "RA", name: "Bergerie RA (nom à confirmer)" },
  { code: "TS", name: "Bergerie TS (nom à confirmer)" },
  { code: "NI", name: "Bergerie NI (nom à confirmer)" },
  { code: "JI", name: "Bergerie JI (nom à confirmer)" },
];

// { matricule, lastName, firstName, note?, role? }
const MEMBERS = [
  { registrationNumber: "1PS16001A", lastName: "Liadé", firstName: "Israël", role: "responsable", note: "Titre d'origine sur le registre : Pasteur. Prénom/nom déduits — à vérifier." },
  { registrationNumber: "1MP16002B", lastName: "Pasteur", firstName: "Maman", role: "responsable", note: "Registre papier : titre seul (« Maman Pasteur »), sans nom civil distinct — à compléter." },
  { registrationNumber: "1EL16003C", lastName: "Achiepo", firstName: "Marcelle" },
  { registrationNumber: "1ME16004D", lastName: "Achiepo", firstName: "Ange" },
  { registrationNumber: "1OL16005E", lastName: "Yatte", firstName: "Cynthia" },
  { registrationNumber: "1SH17006F", lastName: "Mel", firstName: "Vanessa", note: "Épouse Adjaffi" },
  { registrationNumber: "1RO17007G", lastName: "Adjaffi", firstName: "Jean Wilfried" },
  { registrationNumber: "1EL17008H", lastName: "Liadé", firstName: "Blandine", note: "Épouse Bla" },
  { registrationNumber: "1OL17009I", lastName: "Bla", firstName: "Gisèle" },
  { registrationNumber: "1CH17010J", lastName: "Bla", firstName: "David" },
  { registrationNumber: "1RA17011K", lastName: "Bla", firstName: "Lydie" },
  { registrationNumber: "1TS17012L", lastName: "Bla", firstName: "Carmel" },
  { registrationNumber: "1SH17013M", lastName: "Liadé", firstName: "Edwin" },
  { registrationNumber: "1TS19014N", lastName: "Acho", firstName: "Jean Michel" },
  { registrationNumber: "1JI19015O", lastName: "Liadé", firstName: "Jocelyne", note: "Registre papier : chiffre d'église manquant (« JI 19-015 O ») — corrigé ici." },
  { registrationNumber: "1ME19016P", lastName: "Liadé", firstName: "Pacôme" },
  { registrationNumber: "1JI20017Q", lastName: "Assemien", firstName: "Emmanuela", note: "Épouse Liadé" },
  { registrationNumber: "1OL20018R", lastName: "Ouandji", firstName: "Parfait" },
  { registrationNumber: "1NI20019S", lastName: "Kopoin", firstName: "Arthur" },
  { registrationNumber: "1RA20020T", lastName: "Othé", firstName: "Padré Jean Charles", note: "Nom déduit du registre papier — à vérifier." },
  { registrationNumber: "1RA20021U", lastName: "Ye", firstName: "Yves" },
  { registrationNumber: "1TS21022V", lastName: "Gahié", firstName: "Michaëlle", note: "Épouse Fiawoo" },
  { registrationNumber: "1CH21023W", lastName: "Kouadio", firstName: "Marie Jeanne" },
  { registrationNumber: "1NI21024X", lastName: "Dolé", firstName: "Jaurès" },
  { registrationNumber: "1CH21025Y", lastName: "Kah", firstName: "Ulrich" },
  { registrationNumber: "1RA21026Z", lastName: "N'Takpé", firstName: "Joël" },
  { registrationNumber: "1NI21027A", lastName: "Hino", firstName: "Aliana" },
  { registrationNumber: "1OL21028B", lastName: "Gnezélé", firstName: "Edwige Flora" },
  { registrationNumber: "1JI21029C", lastName: "Acho", firstName: "Isabelle", note: "Épouse Sanogo" },
  { registrationNumber: "1SH21030D", lastName: "Zabalou", firstName: "Emmanuella" },
  { registrationNumber: "1ME21031E", lastName: "Sika", firstName: "Jean Yacine" },
  { registrationNumber: "1OL21032F", lastName: "Dehan", firstName: "Ruth" },
  { registrationNumber: "1RO21033G", lastName: "Ezalé", firstName: "Clarisse" },
  { registrationNumber: "1ME22034H", lastName: "Tapé", firstName: "Wilfried" },
  { registrationNumber: "1EL22035I", lastName: "Ogah", firstName: "Romuald" },
  { registrationNumber: "1NI22036J", lastName: "Ogah", firstName: "Elisabeth", note: "Épouse Ogah — nom de famille d'origine non renseigné sur le registre papier." },
  { registrationNumber: "1JI22037K", lastName: "Gnagné", firstName: "Huberson" },
  { registrationNumber: "1SH22038L", lastName: "Vouébou", firstName: "Alex" },
  { registrationNumber: "1CH22039M", lastName: "Gbaté", firstName: "Sara" },
  { registrationNumber: "1ME22040N", lastName: "Ouraga", firstName: "Victoire", note: "Épouse Zadi" },
  { registrationNumber: "1ME22041O", lastName: "Zadi", firstName: "Serges Pacôme" },
  { registrationNumber: "1ME22042P", lastName: "Ambé", firstName: "Alex" },
  { registrationNumber: "1SH23043Q", lastName: "Momboi", firstName: "Jonathan" },
  { registrationNumber: "1ME23044R", lastName: "Wayou", firstName: "Laura", note: "Registre papier : numéro dupliqué avec la ligne 043 (« 1ME 23-043 R ») — corrigé ici en 044, la lettre R étant déjà celle du rang 44." },
];

const CHURCH = 1;

const yearFromRegistrationNumber = (registrationNumber) => {
  const twoDigitYear = Number(registrationNumber.slice(3, 5));

  return 2000 + twoDigitYear;
};

const run = async () => {
  validateEnv();

  await mongoose.connect(env.MONGODB_URI);

  const flockIdByCode = {};

  for (const flock of FLOCKS) {
    const doc = await Flock.findOneAndUpdate(
      { church: CHURCH, code: flock.code },
      { $setOnInsert: { name: flock.name, status: "published" } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    flockIdByCode[flock.code] = doc._id;
  }

  console.log(`  ${FLOCKS.length} bergeries prêtes pour l'église ${CHURCH}.`);

  let created = 0;
  let skipped = 0;

  for (const entry of MEMBERS) {
    const flockCode = entry.registrationNumber.slice(1, 3);
    const joinedAt = new Date(
      yearFromRegistrationNumber(entry.registrationNumber),
      0,
      1
    );

    const existing = await Member.findOne({
      registrationNumber: entry.registrationNumber,
    });

    if (existing) {
      console.log(`  = ${entry.registrationNumber} — déjà en base, ignoré`);

      skipped += 1;

      continue;
    }

    await Member.create({
      firstName: entry.firstName,
      lastName: entry.lastName,
      registrationNumber: entry.registrationNumber,
      church: CHURCH,
      flock: flockIdByCode[flockCode],
      role: entry.role ?? "membre",
      status: "actif",
      joinedAt,
      notes: entry.note,
    });

    console.log(`  ✓ ${entry.registrationNumber} — ${entry.lastName} ${entry.firstName}`);

    created += 1;
  }

  await RegistrationCounter.findOneAndUpdate(
    { church: CHURCH },
    { $max: { lastNumber: MEMBERS.length } },
    { upsert: true }
  );

  console.log(
    `\n  ${created} membres créés, ${skipped} déjà présents. Compteur de l'église ${CHURCH} au moins à ${MEMBERS.length}.`
  );

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(`\n[import registre papier] ÉCHEC : ${error.message}\n`);

  await mongoose.disconnect().catch(() => {});

  process.exit(1);
});
