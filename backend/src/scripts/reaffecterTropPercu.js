import { validateEnv } from "../config/env.js";
import { connectDB, disconnectDB } from "../config/db.js";

import Member from "../models/Member.js";
import SocialContribution from "../models/SocialContribution.js";

import { normalizeRegistrationNumber } from "../services/registrationNumber.service.js";

// Réaffecte le trop-perçu d'un mois vers les mois dus les plus anciens.
//
// À QUOI ÇA SERT. Le montant mensuel est un plancher, pas un plafond :
// verser 5 000 F sur un mois qui en doit 1 000 est un geste valide
// (offrande généreuse) et le système l'enregistre tel quel. Mais quand
// l'intention du membre était de solder cinq mois d'arriéré, l'argent
// se retrouve immobilisé sur un seul mois pendant que les autres
// restent réclamés.
//
// CE QUE LE SCRIPT NE TOUCHE PAS : la caisse. L'argent est entré une
// fois, pour son montant total, et le journal (`SocialLedgerEntry`) en
// garde la trace exacte. Réaffecter ne change ni le solde, ni les
// mouvements, ni les références de reçu déjà émises — uniquement la
// répartition du versement entre les mois. C'est bien pour cela que le
// script n'écrit jamais dans le journal : il n'y a pas d'argent
// nouveau.
//
// SANS ÉCRITURE PAR DÉFAUT : affiche son plan et sort. `--apply` pour
// exécuter (convention commune aux scripts de reprise du projet).
//
// Usage :
//   node backend/src/scripts/reaffecterTropPercu.js 1OL25045S
//   node backend/src/scripts/reaffecterTropPercu.js 1OL25045S --apply

const APPLY = process.argv.includes("--apply");
const RAW_MATRICULE = process.argv.slice(2).find((arg) => !arg.startsWith("--"));

const period = (line) => `${line.year}-${String(line.month).padStart(2, "0")}`;

const run = async () => {
  try {
    validateEnv();
  } catch (error) {
    console.error(`\n${error.message}\n`);

    process.exit(1);
  }

  if (!RAW_MATRICULE) {
    console.error(
      "\nIndiquez le matricule du membre.\n" +
        "  node backend/src/scripts/reaffecterTropPercu.js 1OL25045S\n"
    );

    process.exit(1);
  }

  const registrationNumber = normalizeRegistrationNumber(RAW_MATRICULE);

  if (!registrationNumber) {
    console.error(`\nMatricule illisible : « ${RAW_MATRICULE} »\n`);

    process.exit(1);
  }

  await connectDB();

  const member = await Member.findOne({ registrationNumber }).lean();

  if (!member) {
    console.error(`\nAucun membre avec le matricule ${registrationNumber}.\n`);

    await disconnectDB();
    process.exit(1);
  }

  console.log(
    `\nRéaffectation du trop-perçu — ${member.firstName} ${member.lastName} (${registrationNumber})` +
      `${APPLY ? "" : "  (SIMULATION — relancer avec --apply pour écrire)"}\n`
  );

  const lines = await SocialContribution.find({ member: member._id })
    .sort({ year: 1, month: 1 })
    .lean();

  // Un mois « exonéré » ou « annulé » ne participe à rien : ni source
  // de trop-perçu, ni destination.
  const active = lines.filter(
    (line) => !["exonere", "annule"].includes(line.status)
  );

  const overpaid = active
    .map((line) => ({ line, extra: (line.amountPaid || 0) - (line.amountDue || 0) }))
    .filter((entry) => entry.extra > 0);

  if (overpaid.length === 0) {
    console.log("  Aucun trop-perçu : rien à réaffecter.\n");

    await disconnectDB();

    return;
  }

  let pool = 0;

  console.log("  Trop-perçu disponible :");

  for (const { line, extra } of overpaid) {
    console.log(
      `      ${period(line)} — versé ${line.amountPaid} pour ${line.amountDue} dû → ${extra} F récupérable`
    );
    pool += extra;
  }

  // Du plus ancien au plus récent : on solde la dette dans l'ordre où
  // elle a été contractée.
  const owing = active
    .filter((line) => (line.amountPaid || 0) < (line.amountDue || 0))
    .sort((a, b) => a.year - b.year || a.month - b.month);

  const plan = [];
  let left = pool;

  for (const line of owing) {
    if (left <= 0) break;

    const owed = (line.amountDue || 0) - (line.amountPaid || 0);
    const part = Math.min(owed, left);

    plan.push({ line, part, complete: part >= owed });
    left -= part;
  }

  if (plan.length === 0) {
    console.log("\n  Aucun mois impayé où placer ce trop-perçu.\n");

    await disconnectDB();

    return;
  }

  console.log(`\n  Total à replacer : ${pool} F`);
  console.log("\n  Affectation prévue :");

  for (const { line, part, complete } of plan) {
    console.log(
      `      ${period(line)} ← ${part} F  ${complete ? "(soldé)" : "(partiel)"}`
    );
  }

  if (left > 0) {
    console.log(
      `\n  ${left} F resteront en trop-perçu : plus aucun mois dû où les placer.`
    );
  }

  console.log(
    "\n  La caisse n'est PAS touchée : aucun mouvement créé ni modifié.\n"
  );

  if (!APPLY) {
    console.log("  Rien n'a été écrit. Relancer avec --apply.\n");

    await disconnectDB();

    return;
  }

  // Retire le trop-perçu de sa source, puis le pose sur les mois dus.
  // Fait dans cet ordre pour qu'une interruption laisse au pire de
  // l'argent en attente, jamais de l'argent compté deux fois.
  let taken = pool - left;

  for (const { line, extra } of overpaid) {
    if (taken <= 0) break;

    const remove = Math.min(extra, taken);

    await SocialContribution.updateOne(
      { _id: line._id },
      { $inc: { amountPaid: -remove } }
    );

    taken -= remove;
  }

  for (const { line, part, complete } of plan) {
    await SocialContribution.updateOne(
      { _id: line._id },
      {
        $inc: { amountPaid: part },
        $set: {
          status: complete ? "paye" : "partiel",
          paidAt: line.paidAt ?? new Date(),
        },
      }
    );
  }

  console.log(`  ${plan.length} mois réaffecté(s), ${pool - left} F replacé(s).\n`);

  await disconnectDB();
};

run().catch(async (error) => {
  console.error("\nÉchec de la réaffectation :", error.message, "\n");

  await disconnectDB().catch(() => {});

  process.exit(1);
});
