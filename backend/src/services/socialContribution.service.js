import mongoose from "mongoose";

import SocialFundSettings from "../models/SocialFundSettings.js";
import SocialContribution from "../models/SocialContribution.js";
import SocialLedgerEntry from "../models/SocialLedgerEntry.js";
import SocialCounter from "../models/SocialCounter.js";
import SocialAid from "../models/SocialAid.js";
import Member from "../models/Member.js";
// Importé pour lui-même, jamais référencé directement : `listUnpaid`
// peuple `member.flock`, et Mongoose exige que le modèle « Flock » soit
// enregistré au moment du populate. Sans cet import, la fonction ne
// marchait que par effet de bord — parce que `routes/index.js` charge
// ce modèle ailleurs. Elle échouait dès qu'on l'appelait hors du
// serveur complet (script, test isolé).
import "../models/Flock.js";

import { ApiError } from "../utils/ApiError.js";
import { normalizeRegistrationNumber } from "./registrationNumber.service.js";
import {
  assertExerciceOpen,
  computeYearBalance,
  currentYear,
  recordLedgerEntry,
  SOCIAL_START_YEAR,
} from "./socialFundYear.service.js";

// Logique métier du Service Social (Phase 1 : cotisations, dashboard,
// caisse en lecture) — voir
// docs/superpowers/specs/2026-08-11-service-social-phase1-design.md.
//
// PAS DE TRANSACTION MONGO : aucun service de ce projet n'utilise
// `session`/`startSession`/`withTransaction`, ce n'est pas un pattern
// établi ici. Le paiement multi-mois (recordPayments) traite donc
// chaque mois séquentiellement, avec une opération atomique par ligne
// (`findOneAndUpdate` filtré sur l'état lu juste avant, verrou
// optimiste — même esprit que donation.service.js#review). Le détail
// de chaque mois est renvoyé dans la réponse : aucun sous-ensemble
// n'échoue jamais en silence.

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const monthLabel = (month, year) => `${MONTHS_FR[month - 1] ?? "?"} ${year}`;

const asString = (value, max = 200) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isChurch = (value) =>
  Number.isInteger(value) && value >= 1 && value <= 5;

// Mois courant, TOUJOURS calculé côté serveur (UTC) — jamais reçu du
// client. Un client qui contrôlerait le mois pourrait générer ou
// payer des lignes pour un mois arbitraire.
const currentPeriod = () => {
  const now = new Date();

  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
};

// ------------------------------------------------------------------
// RÉFÉRENCE SOC-YYYYMMDD-NNNNNN
// ------------------------------------------------------------------
// Compteur atomique global (pas par église, contrairement au matricule
// des membres) — voir SocialCounter.js. `findOneAndUpdate` + `$inc` :
// deux paiements simultanés ne peuvent jamais obtenir la même
// référence.
const nextSocialReference = async () => {
  const counter = await SocialCounter.findOneAndUpdate(
    { key: "social" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");

  return `SOC-${yyyy}${mm}${dd}-${String(counter.seq).padStart(6, "0")}`;
};

// ------------------------------------------------------------------
// RÉGLAGES PAR ÉGLISE
// ------------------------------------------------------------------

export const getSettings = async () =>
  SocialFundSettings.find().sort({ church: 1 }).lean();

export const upsertSettings = async (
  church,
  { monthlyContributionAmount } = {},
  user
) => {
  const churchNumber = Number(church);

  if (!isChurch(churchNumber)) {
    throw ApiError.unprocessable("Église invalide.", {
      church: "L'église doit être un nombre entre 1 et 5.",
    });
  }

  const update = { updatedBy: user?.id };

  if (monthlyContributionAmount !== undefined) {
    const amount = Number(monthlyContributionAmount);

    if (!Number.isFinite(amount) || amount < 0) {
      throw ApiError.unprocessable("Montant de cotisation invalide.", {
        monthlyContributionAmount:
          "Le montant doit être un nombre positif ou nul.",
      });
    }

    update.monthlyContributionAmount = amount;
  }

  // Le solde de caisse n'est PLUS un réglage d'église : il appartient
  // désormais à un exercice annuel (voir socialFundYear.service.js).
  // `SocialFundSettings.openingBalance` n'est conservé que le temps de
  // la migration et n'est plus jamais réécrit ici — le laisser
  // modifiable donnerait deux soldes initiaux concurrents.

  const settings = await SocialFundSettings.findOneAndUpdate(
    { church: churchNumber },
    { $set: update },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );

  return settings.toObject();
};

// ------------------------------------------------------------------
// MEMBRES
// ------------------------------------------------------------------

export const searchMembers = async ({ q, church } = {}) => {
  const search = asString(q, 80);

  if (!search) return [];

  const filter = { status: "actif" };

  const churchNumber = Number(church);

  if (isChurch(churchNumber)) filter.church = churchNumber;

  const safe = escapeRegex(search);
  const normalized = normalizeRegistrationNumber(search);

  const or = [
    { firstName: { $regex: safe, $options: "i" } },
    { lastName: { $regex: safe, $options: "i" } },
    { phone: { $regex: safe, $options: "i" } },
    { whatsapp: { $regex: safe, $options: "i" } },
  ];

  if (normalized) {
    or.push({
      registrationNumber: { $regex: escapeRegex(normalized), $options: "i" },
    });
  }

  filter.$or = or;

  return Member.find(filter)
    .select("firstName lastName registrationNumber phone whatsapp church flock status")
    .limit(20)
    .lean();
};

export const getMemberSocialFile = async (memberId) => {
  if (!mongoose.isValidObjectId(memberId)) {
    throw ApiError.notFound("Membre introuvable.");
  }

  const member = await Member.findById(memberId).lean();

  if (!member) throw ApiError.notFound("Membre introuvable.");

  const contributions = await SocialContribution.find({ member: memberId })
    .sort({ year: -1, month: -1 })
    .lean();

  let totalPaid = 0;
  let totalDue = 0;
  let paidCount = 0;
  let unpaidCount = 0;
  let lastPaidAt = null;

  for (const contribution of contributions) {
    totalPaid += contribution.amountPaid || 0;

    // Une ligne exonérée ou annulée ne pèse pas dans la dette : elle
    // reste visible dans l'historique, mais n'est plus réclamée.
    if (!["exonere", "annule"].includes(contribution.status)) {
      totalDue += contribution.amountDue || 0;
    }

    if (contribution.status === "paye") paidCount += 1;
    if (["non_paye", "partiel"].includes(contribution.status)) unpaidCount += 1;

    if (
      contribution.paidAt &&
      (!lastPaidAt || contribution.paidAt > lastPaidAt)
    ) {
      lastPaidAt = contribution.paidAt;
    }
  }

  // `balance` est le cumul demandé : ce que le membre doit encore,
  // toutes années confondues depuis SOCIAL_START_YEAR. Négatif s'il a
  // donné plus que le minimum (`amountDue` est un plancher, pas un
  // plafond) — on expose alors ce surplus séparément plutôt que de le
  // présenter comme une dette négative.
  const balance = totalDue - totalPaid;

  return {
    member,
    contributions,
    totals: {
      totalPaid,
      totalDue,
      balance: Math.max(balance, 0),
      overpaid: Math.max(-balance, 0),
      paidCount,
      unpaidCount,
      lastPaidAt,
    },
  };
};

// ------------------------------------------------------------------
// GÉNÉRATION DES LIGNES DUES (rattrapage historique + job quotidien)
// ------------------------------------------------------------------
//
// La génération ne se limite plus au mois courant : elle rattrape
// TOUS les mois dus depuis SOCIAL_START_YEAR (2024). Sans ce
// rattrapage, un membre validé aujourd'hui n'avait aucune ligne pour
// les mois écoulés — donc aucun arriéré, donc rien à cumuler, alors
// que la dette d'un membre doit précisément s'accumuler mois après
// mois.
//
// MONTANT DES MOIS RATTRAPÉS : le montant mensuel EN VIGUEUR
// AUJOURD'HUI est appliqué aux mois passés, faute d'historique des
// tarifs (`SocialFundSettings` ne garde que la valeur courante). Les
// lignes déjà émises, elles, ne sont jamais réécrites : leur
// `amountDue` reste figé au tarif de leur époque, comme documenté sur
// le modèle.

// Toutes les périodes (année, mois) de `from` à `to`, bornes incluses.
const monthsBetween = (from, to) => {
  const periods = [];

  let year = from.year;
  let month = from.month;

  while (year < to.year || (year === to.year && month <= to.month)) {
    periods.push({ year, month });

    month += 1;

    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return periods;
};

// Premier mois dû par un membre : son mois d'arrivée, jamais avant
// SOCIAL_START_YEAR. Un membre présent depuis 2016 ne doit pas se voir
// réclamer dix ans d'arriérés (décision de cadrage : les arriérés
// remontent à 2024) ; un membre arrivé en 2025 ne doit rien devoir
// pour 2024.
const firstDuePeriodFor = (member) => {
  const floor = { year: SOCIAL_START_YEAR, month: 1 };

  if (!member?.joinedAt) return floor;

  const joined = new Date(member.joinedAt);

  if (Number.isNaN(joined.getTime())) return floor;

  const year = joined.getUTCFullYear();

  if (year < floor.year) return floor;

  return { year, month: joined.getUTCMonth() + 1 };
};

const periodKey = (memberId, year, month) => `${memberId}:${year}:${month}`;

// L'index unique {member, year, month} est le vrai garde-fou
// anti-doublon ; le filtrage préalable évite simplement le bruit
// d'erreurs 11000 à chaque passage. Le try/catch reste nécessaire pour
// la course entre deux exécutions concurrentes (rattrapage manuel
// pendant le job planifié, par exemple).
const insertIgnoringDuplicates = async (docs) => {
  try {
    const inserted = await SocialContribution.insertMany(docs, {
      ordered: false,
    });

    return inserted.length;
  } catch (error) {
    const isDuplicateKeyError =
      error?.code === 11000 ||
      (Array.isArray(error?.writeErrors) &&
        error.writeErrors.every(
          (e) => e.code === 11000 || e.err?.code === 11000
        ));

    if (!isDuplicateKeyError) throw error;

    return error.insertedDocs?.length ?? 0;
  }
};

// Génère les lignes manquantes.
//
// `church` (facultatif) restreint le balayage à une seule église —
// SANS filtre (cas du job planifié, voir
// socialContributionsGenerator.js), la fonction traite TOUTES les
// églises dotées d'un SocialFundSettings, y compris les vraies églises
// en production. Un test d'intégration qui appelle cette fonction sans
// préciser son église de test régénère donc, en effet de bord, les
// offrandes réelles de toute église déjà configurée — bug constaté
// concrètement lors de la Phase 1. D'où ce paramètre, que la suite de
// tests doit toujours passer.
//
// `members` (facultatif) restreint à une liste de membres déjà
// chargés, pour le cas « un membre vient d'être validé, il lui faut
// ses lignes tout de suite » sans rebalayer toute l'église.
export const generateDueContributions = async ({ church, members } = {}) => {
  const upTo = currentPeriod();

  const settingsList = await SocialFundSettings.find(
    church ? { church } : {}
  ).lean();

  let createdTotal = 0;

  for (const settings of settingsList) {
    const churchNumber = settings.church;

    const scopedMembers = members
      ? members.filter((member) => Number(member.church) === churchNumber)
      : await Member.find({ church: churchNumber, status: "actif" })
          .select("_id flock joinedAt")
          .lean();

    if (scopedMembers.length === 0) continue;

    const existing = await SocialContribution.find({
      member: { $in: scopedMembers.map((member) => member._id) },
      year: { $gte: SOCIAL_START_YEAR },
    })
      .select("member year month")
      .lean();

    const alreadyCovered = new Set(
      existing.map((line) => periodKey(line.member, line.year, line.month))
    );

    const docs = [];

    for (const member of scopedMembers) {
      const periods = monthsBetween(firstDuePeriodFor(member), upTo);

      for (const { year, month } of periods) {
        if (alreadyCovered.has(periodKey(member._id, year, month))) continue;

        docs.push({
          member: member._id,
          church: churchNumber,
          flock: member.flock,
          year,
          month,
          amountDue: settings.monthlyContributionAmount,
          amountPaid: 0,
          status: "non_paye",
        });
      }
    }

    if (docs.length === 0) continue;

    createdTotal += await insertIgnoringDuplicates(docs);
  }

  return createdTotal;
};

// Rattrapage ciblé sur UN membre — appelé dès qu'un membre est créé ou
// validé, pour qu'il apparaisse immédiatement dans les listes du
// Service Social au lieu d'attendre le prochain passage du job
// quotidien (jusqu'à 24 h).
export const ensureMemberContributions = async (member) => {
  const memberId = member?._id ?? member?.id;

  if (!memberId) return 0;

  // Un membre inactif ne cotise pas : le job de génération ne retient
  // que `status: "actif"`, ce raccourci doit appliquer la même règle.
  if (member.status && member.status !== "actif") return 0;

  const churchNumber = Number(member.church);

  if (!isChurch(churchNumber)) return 0;

  return generateDueContributions({
    church: churchNumber,
    members: [
      {
        _id: memberId,
        church: churchNumber,
        flock: member.flock,
        joinedAt: member.joinedAt,
      },
    ],
  });
};

// Variante « au mieux » pour les chemins où l'échec de la génération
// ne doit surtout pas annuler l'opération principale : valider une
// inscription reste valide même si le Service Social est momentanément
// indisponible. L'erreur est journalisée, jamais avalée en silence, et
// le job quotidien rattrapera de toute façon.
export const syncMemberContributionsQuietly = async (member) => {
  try {
    return await ensureMemberContributions(member);
  } catch (error) {
    console.error(
      "[socialContribution] génération des cotisations impossible pour le membre",
      String(member?._id ?? member?.id ?? "?"),
      ":",
      error.message
    );

    return 0;
  }
};

// ------------------------------------------------------------------
// PAIEMENT
// ------------------------------------------------------------------

export const recordPayments = async ({ memberId, payments } = {}, user) => {
  if (!mongoose.isValidObjectId(memberId)) {
    throw ApiError.notFound("Membre introuvable.");
  }

  const member = await Member.findById(memberId).lean();

  if (!member) throw ApiError.notFound("Membre introuvable.");

  if (!Array.isArray(payments) || payments.length === 0) {
    throw ApiError.unprocessable("Aucun paiement à enregistrer.", {
      payments: "Indiquez au moins un mois à régler.",
    });
  }

  // Contrôle de l'exercice AVANT de toucher la moindre cotisation :
  // découvrir une caisse clôturée au moment d'écrire au journal
  // laisserait des mois marqués « payé » sans contrepartie en caisse.
  await assertExerciceOpen(member.church, user);

  let settingsForMember; // chargé au besoin, une seule fois

  const results = [];
  let totalPaid = 0;

  for (const raw of payments) {
    const year = Number(raw?.year);
    const month = Number(raw?.month);
    const amount = Number(raw?.amount);

    if (
      !Number.isInteger(year) || year < 2000 || year > 2100 ||
      !Number.isInteger(month) || month < 1 || month > 12 ||
      !Number.isFinite(amount) || amount <= 0
    ) {
      results.push({
        year: raw?.year,
        month: raw?.month,
        ok: false,
        reason: "Ligne de paiement invalide.",
      });
      continue;
    }

    let contribution = await SocialContribution.findOne({
      member: memberId,
      year,
      month,
    });

    // Le job de génération n'est peut-être pas encore passé pour ce
    // mois : on crée la ligne à la volée, au montant courant de
    // l'église du membre.
    if (!contribution) {
      if (settingsForMember === undefined) {
        settingsForMember = member.church
          ? await SocialFundSettings.findOne({ church: member.church }).lean()
          : null;
      }

      if (!settingsForMember) {
        results.push({
          year,
          month,
          ok: false,
          reason:
            "Aucune configuration du Service Social pour l'église de ce membre.",
        });
        continue;
      }

      try {
        contribution = await SocialContribution.create({
          member: memberId,
          church: member.church,
          flock: member.flock,
          year,
          month,
          amountDue: settingsForMember.monthlyContributionAmount,
          amountPaid: 0,
          status: "non_paye",
        });
      } catch (error) {
        // Créée entre-temps par un autre agent (index unique) : on la
        // relit plutôt que d'échouer cette ligne.
        if (error?.code === 11000) {
          contribution = await SocialContribution.findOne({
            member: memberId,
            year,
            month,
          });
        } else {
          throw error;
        }
      }
    }

    if (!contribution) {
      results.push({
        year,
        month,
        ok: false,
        reason: "Impossible de créer la ligne de cotisation.",
      });
      continue;
    }

    if (contribution.status === "paye") {
      results.push({ year, month, ok: false, reason: "déjà payé" });
      continue;
    }

    if (contribution.status === "exonere") {
      results.push({ year, month, ok: false, reason: "mois exonéré" });
      continue;
    }

    if (contribution.status === "annule") {
      results.push({ year, month, ok: false, reason: "ligne annulée" });
      continue;
    }

    // `amountDue` est un PLANCHER, pas un plafond : un membre reste
    // libre de donner plus que le montant mensuel minimal pour un même
    // mois (offrande généreuse) — voir SocialFundSettings. Seul un
    // montant sous ce plancher laisse le mois "partiel".
    const newAmountPaid = (contribution.amountPaid || 0) + amount;
    const newStatus = newAmountPaid >= contribution.amountDue ? "paye" : "partiel";
    const reference = contribution.reference || (await nextSocialReference());

    // Verrou optimiste : le filtre reprend l'état exactement lu à
    // l'instant, comme donation.service.js#review. Si un autre agent a
    // modifié la ligne entretemps, l'update ne matche rien : on le
    // signale plutôt que d'écraser une décision concurrente.
    const updated = await SocialContribution.findOneAndUpdate(
      {
        _id: contribution._id,
        status: contribution.status,
        amountPaid: contribution.amountPaid,
      },
      {
        $set: {
          amountPaid: newAmountPaid,
          status: newStatus,
          reference,
          paidAt: new Date(),
          recordedBy: user.id,
        },
      },
      { new: true }
    );

    if (!updated) {
      results.push({
        year,
        month,
        ok: false,
        reason:
          "Cette cotisation a été modifiée entretemps par un autre agent. Réessayez.",
      });
      continue;
    }

    // Jamais `SocialLedgerEntry.create` en direct : `recordLedgerEntry`
    // rattache le mouvement à l'exercice courant et refuse une caisse
    // clôturée (voir socialFundYear.service.js).
    await recordLedgerEntry(
      {
        church: updated.church,
        type: "cotisation",
        reference,
        description: `Cotisation — ${member.firstName} ${member.lastName} — ${monthLabel(month, year)}`,
        amount,
      },
      user
    );

    results.push({
      year,
      month,
      ok: true,
      id: updated._id,
      reference,
      status: newStatus,
    });
    totalPaid += amount;
  }

  return { results, totalPaid };
};

// ------------------------------------------------------------------
// EXONÉRATION
// ------------------------------------------------------------------

export const exempt = async (contributionId, { motif } = {}, user) => {
  if (!mongoose.isValidObjectId(contributionId)) {
    throw ApiError.notFound("Cotisation introuvable.");
  }

  const trimmedMotif = asString(motif, 300);

  if (!trimmedMotif) {
    throw ApiError.unprocessable("Le motif d'exonération est obligatoire.", {
      motif: "Indiquez le motif de l'exonération.",
    });
  }

  const contribution = await SocialContribution.findOneAndUpdate(
    { _id: contributionId, status: { $in: ["non_paye", "partiel"] } },
    {
      $set: {
        status: "exonere",
        exemption: { motif: trimmedMotif, by: user.id, at: new Date() },
      },
    },
    { new: true }
  );

  if (!contribution) {
    const existing = await SocialContribution.findById(contributionId).lean();

    if (!existing) throw ApiError.notFound("Cotisation introuvable.");

    throw ApiError.conflict(
      "Seule une cotisation non payée ou partiellement payée peut être exonérée."
    );
  }

  return contribution;
};

// ------------------------------------------------------------------
// LISTES
// ------------------------------------------------------------------

const STATUS_VALUES = ["non_paye", "paye", "partiel", "exonere", "annule"];

// « En retard » n'est pas un statut stocké (voir SocialContribution.js)
// mais l'administration doit pouvoir filtrer dessus. Le critère est
// donc traduit ici en condition Mongo, côté serveur : le faire côté
// navigateur ne filtrait que la page affichée, et manquait donc tous
// les retardataires des pages suivantes.
const statusCriteria = (status) => {
  if (status === "retard") {
    const { year, month } = currentPeriod();

    return {
      status: { $in: ["non_paye", "partiel"] },
      $or: [{ year: { $lt: year } }, { year, month: { $lt: month } }],
    };
  }

  return STATUS_VALUES.includes(status) ? { status } : {};
};

const buildPeriodFilter = async ({ church, year, month, search }) => {
  const filter = {};

  if (isChurch(Number(church))) filter.church = Number(church);
  if (Number.isInteger(Number(year))) filter.year = Number(year);
  if (
    Number.isInteger(Number(month)) &&
    Number(month) >= 1 &&
    Number(month) <= 12
  ) {
    filter.month = Number(month);
  }

  const trimmedSearch = asString(search, 80);

  if (trimmedSearch) {
    const safe = escapeRegex(trimmedSearch);
    const normalized = normalizeRegistrationNumber(trimmedSearch);

    const or = [
      { firstName: { $regex: safe, $options: "i" } },
      { lastName: { $regex: safe, $options: "i" } },
    ];

    if (normalized) {
      or.push({
        registrationNumber: { $regex: escapeRegex(normalized), $options: "i" },
      });
    }

    const matchingMembers = await Member.find({ $or: or }).select("_id").lean();

    filter.member = { $in: matchingMembers.map((m) => m._id) };
  }

  return filter;
};

const sumContributions = async (filter) => {
  const [aggregate] = await SocialContribution.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        // Une ligne exonérée ou annulée n'est plus réclamée : elle ne
        // doit pas gonfler le montant attendu du mois, sinon le taux
        // de recouvrement affiché ne pourra jamais atteindre 100 %.
        amountDue: {
          $sum: {
            $cond: [
              { $in: ["$status", ["exonere", "annule"]] },
              0,
              "$amountDue",
            ],
          },
        },
        amountPaid: { $sum: "$amountPaid" },
        count: { $sum: 1 },
      },
    },
  ]);

  const amountDue = aggregate?.amountDue ?? 0;
  const amountPaid = aggregate?.amountPaid ?? 0;

  return {
    amountDue,
    amountPaid,
    remaining: Math.max(amountDue - amountPaid, 0),
    rate: amountDue > 0 ? Math.round((amountPaid / amountDue) * 100) : 0,
    count: aggregate?.count ?? 0,
  };
};

export const listContributions = async ({
  church,
  year,
  month,
  status,
  search,
  page = 1,
  limit = 20,
} = {}) => {
  const periodFilter = await buildPeriodFilter({ church, year, month, search });
  const filter = { ...periodFilter, ...statusCriteria(status) };

  const perPage = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const current = Math.max(Number(page) || 1, 1);

  // `totals` porte sur TOUTE la période affichée, filtre de statut
  // exclu et pagination comprise : la barre de totaux de l'écran doit
  // décrire le mois entier, pas les 20 lignes visibles. Elle était
  // jusqu'ici calculée dans le navigateur sur la seule page chargée,
  // donc fausse dès que le mois dépassait la taille de page.
  const [items, total, totals] = await Promise.all([
    SocialContribution.find(filter)
      .sort({ year: -1, month: -1, createdAt: -1 })
      .skip((current - 1) * perPage)
      .limit(perPage)
      .populate("member", "firstName lastName registrationNumber phone")
      .populate("recordedBy", "name")
      .lean(),
    SocialContribution.countDocuments(filter),
    sumContributions(periodFilter),
  ]);

  return { items, total, page: current, perPage, totals };
};

// Arriérés cumulés, un agrégat par membre : qui doit encore, combien,
// et depuis quels mois. C'est la vue « qui participe / qui doit
// encore » du cahier des charges.
//
// « En retard » se dérive de la période, jamais d'un statut stocké :
// le mois courant n'est pas encore en retard tant qu'il n'est pas
// écoulé.
export const listUnpaid = async ({ church, year } = {}) => {
  const { year: curYear, month: curMonth } = currentPeriod();

  const match = {
    status: { $in: ["non_paye", "partiel"] },
    $or: [
      { year: { $lt: curYear } },
      { year: curYear, month: { $lt: curMonth } },
    ],
  };

  if (isChurch(Number(church))) match.church = Number(church);

  // Filtre facultatif sur un exercice : « qui doit encore pour 2025 »,
  // par opposition au cumul de toutes les années.
  if (Number.isInteger(Number(year))) match.year = Number(year);

  const rows = await SocialContribution.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$member",
        unpaidMonths: {
          $push: {
            year: "$year",
            month: "$month",
            amountDue: "$amountDue",
            amountPaid: "$amountPaid",
          },
        },
        monthsCount: { $sum: 1 },
        totalDue: { $sum: "$amountDue" },
        totalPaid: { $sum: "$amountPaid" },
      },
    },
    { $sort: { totalDue: -1 } },
  ]);

  const memberIds = rows.map((row) => row._id);

  const members = await Member.find({ _id: { $in: memberIds } })
    .select("firstName lastName registrationNumber phone whatsapp church flock status")
    .populate("flock", "name")
    .lean();

  const memberMap = new Map(members.map((m) => [String(m._id), m]));

  return rows.map((row) => ({
    member: memberMap.get(String(row._id)) ?? null,
    unpaidMonths: [...row.unpaidMonths].sort(
      (a, b) => a.year - b.year || a.month - b.month
    ),
    monthsCount: row.monthsCount,
    totalDue: row.totalDue,
    totalPaid: row.totalPaid,
    // Ce qu'il reste réellement à recouvrer, une fois déduits les
    // paiements partiels déjà encaissés sur ces mois.
    remaining: Math.max(row.totalDue - row.totalPaid, 0),
  }));
};

// ------------------------------------------------------------------
// DASHBOARD & CAISSE
// ------------------------------------------------------------------

const churchesInScope = async (church) => {
  if (isChurch(Number(church))) {
    const settings = await SocialFundSettings.findOne({
      church: Number(church),
    }).lean();

    return settings ? [Number(church)] : [];
  }

  const all = await SocialFundSettings.find().select("church").lean();

  return all.map((s) => s.church);
};

// ------------------------------------------------------------------
// SOLDE DE CAISSE
// ------------------------------------------------------------------
// Le calcul ne vit plus ici : il appartient à l'exercice annuel (voir
// socialFundYear.service.js#computeYearBalance). Ce module se contente
// d'additionner les exercices COURANTS des églises de son périmètre,
// pour le seul besoin du dashboard, qui peut afficher plusieurs
// églises à la fois.
const currentBalanceForChurches = async (churches) => {
  if (churches.length === 0) return 0;

  const balances = await Promise.all(
    churches.map((church) => computeYearBalance(church, currentYear()))
  );

  return balances.reduce((sum, balance) => sum + balance.currentBalance, 0);
};

export const dashboard = async ({ church } = {}) => {
  const hasChurch = isChurch(Number(church));
  const { year, month } = currentPeriod();

  const churches = await churchesInScope(church);

  if (churches.length === 0) {
    return {
      church: hasChurch ? Number(church) : null,
      activeMembers: 0,
      contributionsThisMonth: { paidCount: 0, totalMembers: 0 },
      amountCollectedThisMonth: 0,
      lateContributions: 0,
      cashBalance: 0,
      aidAmountThisMonth: 0,
      aidCount: 0,
      paymentRate: 0,
    };
  }

  // Bornes du mois courant, UTC — cohérent avec `currentPeriod()`
  // ci-dessus, jamais l'heure/le fuseau du navigateur.
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  const [
    activeMembers,
    contributionsAgg,
    lateMemberIds,
    cashBalance,
    aidAgg,
  ] = await Promise.all([
    Member.countDocuments({ status: "actif", church: { $in: churches } }),

    SocialContribution.aggregate([
      { $match: { church: { $in: churches }, year, month } },
      {
        $group: {
          _id: null,
          paidCount: { $sum: { $cond: [{ $eq: ["$status", "paye"] }, 1, 0] } },
          totalMembers: { $sum: 1 },
          amountCollected: { $sum: "$amountPaid" },
        },
      },
    ]),

    SocialContribution.distinct("member", {
      church: { $in: churches },
      status: { $in: ["non_paye", "partiel"] },
      $or: [{ year: { $lt: year } }, { year, month: { $lt: month } }],
    }),

    currentBalanceForChurches(churches),

    // Aides décaissées ("payee") ce mois-ci, dans le périmètre — voir
    // socialAid.service.js pour le workflow qui pose `paidAt`.
    SocialAid.aggregate([
      {
        $match: {
          church: { $in: churches },
          status: "payee",
          paidAt: { $gte: monthStart, $lt: monthEnd },
        },
      },
      {
        $group: {
          _id: null,
          amount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const contributions = contributionsAgg[0] ?? {
    paidCount: 0,
    totalMembers: 0,
    amountCollected: 0,
  };

  const aid = aidAgg[0] ?? { amount: 0, count: 0 };

  return {
    church: hasChurch ? Number(church) : null,
    activeMembers,
    contributionsThisMonth: {
      paidCount: contributions.paidCount,
      totalMembers: contributions.totalMembers,
    },
    amountCollectedThisMonth: contributions.amountCollected,
    lateContributions: lateMemberIds.length,
    cashBalance,
    aidAmountThisMonth: aid.amount,
    aidCount: aid.count,
    paymentRate:
      contributions.totalMembers > 0
        ? Math.round((contributions.paidCount / contributions.totalMembers) * 1000) / 10
        : 0,
  };
};

// État d'UNE caisse : une église, un exercice. Contrairement au
// dashboard, il n'y a jamais d'agrégat « toutes les églises » — un
// solde de caisse appartient à une caisse physique, pas à une somme
// d'églises.
export const caisse = async ({ church, year } = {}) => {
  const churchNumber = Number(church);

  if (!isChurch(churchNumber)) {
    throw ApiError.unprocessable(
      "L'église est obligatoire pour consulter une caisse.",
      { church: "Sélectionnez une église." }
    );
  }

  const settings = await SocialFundSettings.findOne({
    church: churchNumber,
  }).lean();

  // Église sans module Service Social actif : `null` plutôt que des
  // zéros, pour que l'écran distingue « caisse vide » de « module pas
  // encore configuré » (il affiche déjà les deux différemment).
  if (!settings) return null;

  const exercice = Number.isInteger(Number(year))
    ? Number(year)
    : currentYear();

  return computeYearBalance(churchNumber, exercice);
};

export const ledgerMovements = async ({
  church,
  year,
  page = 1,
  limit = 20,
} = {}) => {
  const filter = {};

  if (isChurch(Number(church))) filter.church = Number(church);

  // Les mouvements appartiennent à un exercice : sans ce filtre, la
  // caisse 2027 afficherait aussi les lignes de 2024.
  if (Number.isInteger(Number(year))) filter.year = Number(year);

  const perPage = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const current = Math.max(Number(page) || 1, 1);

  const [items, total] = await Promise.all([
    SocialLedgerEntry.find(filter)
      .sort({ createdAt: -1 })
      .skip((current - 1) * perPage)
      .limit(perPage)
      .populate("recordedBy", "name")
      .lean(),
    SocialLedgerEntry.countDocuments(filter),
  ]);

  return { items, total, page: current, perPage };
};

// ------------------------------------------------------------------
// REÇU
// ------------------------------------------------------------------

export const getReceiptData = async (contributionId) => {
  if (!mongoose.isValidObjectId(contributionId)) {
    throw ApiError.notFound("Cotisation introuvable.");
  }

  const contribution = await SocialContribution.findById(contributionId)
    .populate({
      path: "member",
      select: "firstName lastName registrationNumber church flock",
      populate: { path: "flock", select: "name" },
    })
    .populate("recordedBy", "name")
    .lean();

  if (!contribution) throw ApiError.notFound("Cotisation introuvable.");

  if (!["paye", "partiel"].includes(contribution.status)) {
    throw ApiError.badRequest(
      "Aucun reçu ne peut être émis pour une cotisation non payée."
    );
  }

  return contribution;
};
