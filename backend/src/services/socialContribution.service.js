import mongoose from "mongoose";

import SocialFundSettings from "../models/SocialFundSettings.js";
import SocialContribution from "../models/SocialContribution.js";
import SocialLedgerEntry from "../models/SocialLedgerEntry.js";
import SocialCounter from "../models/SocialCounter.js";
import SocialAid from "../models/SocialAid.js";
import Member from "../models/Member.js";

import { ApiError } from "../utils/ApiError.js";
import { normalizeRegistrationNumber } from "./registrationNumber.service.js";

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
  { monthlyContributionAmount, openingBalance } = {},
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

  if (openingBalance !== undefined) {
    const opening = Number(openingBalance);

    if (!Number.isFinite(opening) || opening < 0) {
      throw ApiError.unprocessable("Solde initial invalide.", {
        openingBalance: "Le solde initial doit être un nombre positif ou nul.",
      });
    }

    update.openingBalance = opening;
  }

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
  let paidCount = 0;
  let unpaidCount = 0;
  let lastPaidAt = null;

  for (const contribution of contributions) {
    totalPaid += contribution.amountPaid || 0;

    if (contribution.status === "paye") paidCount += 1;
    if (["non_paye", "partiel"].includes(contribution.status)) unpaidCount += 1;

    if (
      contribution.paidAt &&
      (!lastPaidAt || contribution.paidAt > lastPaidAt)
    ) {
      lastPaidAt = contribution.paidAt;
    }
  }

  return {
    member,
    contributions,
    totals: { totalPaid, paidCount, unpaidCount, lastPaidAt },
  };
};

// ------------------------------------------------------------------
// GÉNÉRATION MENSUELLE (job planifié)
// ------------------------------------------------------------------

// Idempotente par construction : l'index unique {member,year,month}
// est le vrai garde-fou anti-doublon. Le filtrage préalable sur les
// membres déjà couverts évite simplement le bruit d'erreurs 11000 à
// chaque passage quotidien ; le try/catch reste nécessaire pour la
// course entre deux exécutions concurrentes du job (backfill manuel +
// job planifié, par exemple).
//
// `church` (facultatif) restreint le balayage à une seule église —
// SANS filtre (cas réel du job planifié, voir
// socialContributionsGenerator.js), la fonction traite TOUTES les
// églises dotées d'un SocialFundSettings, y compris les vraies églises
// en production. Un test d'intégration qui appelle cette fonction sans
// préciser son église de test régénère donc, en effet de bord, les
// offrandes réelles de toute église déjà configurée (église 1 en
// pratique) — bug constaté concrètement : des offrandes réellement
// payées ont été écrasées par une ligne "non_paye" fraîchement
// régénérée pendant l'exécution de la suite de tests. D'où l'ajout de
// ce paramètre, utilisé par socialContribution.service.test.js pour se
// cantonner à son église de test.
export const generateDueContributionsForCurrentMonth = async ({ church } = {}) => {
  const { year, month } = currentPeriod();

  const settingsList = await SocialFundSettings.find(
    church ? { church } : {}
  ).lean();

  let createdTotal = 0;

  for (const settings of settingsList) {
    const church = settings.church;

    const members = await Member.find({ church, status: "actif" })
      .select("_id flock")
      .lean();

    if (members.length === 0) continue;

    const existing = await SocialContribution.find({ church, year, month })
      .select("member")
      .lean();

    const existingIds = new Set(existing.map((c) => String(c.member)));

    const docs = members
      .filter((m) => !existingIds.has(String(m._id)))
      .map((m) => ({
        member: m._id,
        church,
        flock: m.flock,
        year,
        month,
        amountDue: settings.monthlyContributionAmount,
        amountPaid: 0,
        status: "non_paye",
      }));

    if (docs.length === 0) continue;

    try {
      const inserted = await SocialContribution.insertMany(docs, {
        ordered: false,
      });

      createdTotal += inserted.length;
    } catch (error) {
      const isDuplicateKeyError =
        error?.code === 11000 ||
        (Array.isArray(error?.writeErrors) &&
          error.writeErrors.every(
            (e) => e.code === 11000 || e.err?.code === 11000
          ));

      if (!isDuplicateKeyError) throw error;

      createdTotal += error.insertedDocs?.length ?? 0;
    }
  }

  return createdTotal;
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

    await SocialLedgerEntry.create({
      church: updated.church,
      type: "cotisation",
      reference,
      description: `Cotisation — ${member.firstName} ${member.lastName} — ${monthLabel(month, year)}`,
      amount,
      recordedBy: user.id,
    });

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

export const listContributions = async ({
  church,
  year,
  month,
  status,
  search,
  page = 1,
  limit = 20,
} = {}) => {
  const filter = {};

  if (isChurch(Number(church))) filter.church = Number(church);
  if (Number.isInteger(Number(year))) filter.year = Number(year);
  if (Number.isInteger(Number(month)) && Number(month) >= 1 && Number(month) <= 12) {
    filter.month = Number(month);
  }
  if (STATUS_VALUES.includes(status)) filter.status = status;

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

  const perPage = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const current = Math.max(Number(page) || 1, 1);

  const [items, total] = await Promise.all([
    SocialContribution.find(filter)
      .sort({ year: -1, month: -1, createdAt: -1 })
      .skip((current - 1) * perPage)
      .limit(perPage)
      .populate("member", "firstName lastName registrationNumber phone")
      .populate("recordedBy", "name")
      .lean(),
    SocialContribution.countDocuments(filter),
  ]);

  return { items, total, page: current, perPage };
};

export const listUnpaid = async ({ church } = {}) => {
  const { year: curYear, month: curMonth } = currentPeriod();

  const match = {
    status: { $in: ["non_paye", "partiel"] },
    $or: [
      { year: { $lt: curYear } },
      { year: curYear, month: { $lt: curMonth } },
    ],
  };

  if (isChurch(Number(church))) match.church = Number(church);

  const rows = await SocialContribution.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$member",
        unpaidMonths: { $push: { year: "$year", month: "$month" } },
        monthsCount: { $sum: 1 },
        totalDue: { $sum: { $subtract: ["$amountDue", "$amountPaid"] } },
      },
    },
    { $sort: { totalDue: -1 } },
  ]);

  const memberIds = rows.map((row) => row._id);

  const members = await Member.find({ _id: { $in: memberIds } })
    .select("firstName lastName registrationNumber phone church flock")
    .lean();

  const memberMap = new Map(members.map((m) => [String(m._id), m]));

  return rows.map((row) => ({
    member: memberMap.get(String(row._id)) ?? null,
    unpaidMonths: [...row.unpaidMonths].sort(
      (a, b) => a.year - b.year || a.month - b.month
    ),
    monthsCount: row.monthsCount,
    totalDue: row.totalDue,
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
// SOLDE DE CAISSE — SOURCE UNIQUE DE CALCUL
// ------------------------------------------------------------------
// `caisse()`, `dashboard()` et le service Aides sociales
// (socialAid.service.js#validateAid, qui doit bloquer un décaissement
// dépassant le solde disponible) ont tous besoin du même calcul :
// openingBalance + somme signée des SocialLedgerEntry. Une seule
// fonction interne fait cette agrégation ; `computeCashBalance` en est
// la version publique, à une seule église, exportée pour être
// réutilisée par socialAid.service.js — jamais dupliquée.
const cashSummaryForChurches = async (churches) => {
  if (churches.length === 0) {
    return { openingBalance: 0, ledgerTotal: 0, currentBalance: 0 };
  }

  const [settingsList, ledgerAgg] = await Promise.all([
    SocialFundSettings.find({ church: { $in: churches } })
      .select("openingBalance")
      .lean(),
    SocialLedgerEntry.aggregate([
      { $match: { church: { $in: churches } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  const openingBalance = settingsList.reduce(
    (sum, s) => sum + (s.openingBalance || 0),
    0
  );
  const ledgerTotal = ledgerAgg[0]?.total ?? 0;

  return {
    openingBalance,
    ledgerTotal,
    currentBalance: openingBalance + ledgerTotal,
  };
};

// Solde actuel d'UNE église, recalculé côté serveur — jamais reçu du
// client. Utilisé par socialAid.service.js#validateAid pour bloquer
// (409) un décaissement qui dépasserait ce solde.
export const computeCashBalance = async (church) => {
  const churchNumber = Number(church);

  if (!isChurch(churchNumber)) return 0;

  const summary = await cashSummaryForChurches([churchNumber]);

  return summary.currentBalance;
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
    cashSummary,
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

    cashSummaryForChurches(churches),

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
    cashBalance: cashSummary.currentBalance,
    aidAmountThisMonth: aid.amount,
    aidCount: aid.count,
    paymentRate:
      contributions.totalMembers > 0
        ? Math.round((contributions.paidCount / contributions.totalMembers) * 1000) / 10
        : 0,
  };
};

export const caisse = async ({ church } = {}) => {
  const hasChurch = isChurch(Number(church));
  const churches = await churchesInScope(church);

  const { openingBalance, ledgerTotal: totalCotisations } =
    await cashSummaryForChurches(churches);

  return {
    church: hasChurch ? Number(church) : null,
    openingBalance,
    totalCotisations,
    currentBalance: openingBalance + totalCotisations,
  };
};

export const ledgerMovements = async ({ church, page = 1, limit = 20 } = {}) => {
  const filter = {};

  if (isChurch(Number(church))) filter.church = Number(church);

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
