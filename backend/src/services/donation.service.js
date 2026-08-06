import Donation from "../models/Donation.js";
import PaymentMethod from "../models/PaymentMethod.js";
import DonationType from "../models/DonationType.js";

import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";

// Logique métier des dons.
//
// Aucune confirmation automatique n'existe dans ce modèle : la seule
// autorité sur le statut d'un don est `review()`, appelée par un
// administrateur après vérification manuelle du relevé Mobile Money
// de l'église. Voir la spec pour la discussion complète des risques
// de fraude.

const MIN_AMOUNT = 200;
const MAX_AMOUNT = 10000000;

const asString = (value, max) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

// ------------------------------------------------------------------
// CRÉATION
// ------------------------------------------------------------------

export const createDonation = async (input, { ip } = {}) => {
  const amount = Number(input?.amount);

  if (!Number.isInteger(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    throw ApiError.unprocessable("Le montant du don est invalide.", {
      amount: `Indiquez un montant entier entre ${MIN_AMOUNT} et ${MAX_AMOUNT} F CFA.`,
    });
  }

  const firstName = asString(input?.donor?.firstName, 60);
  const lastName = asString(input?.donor?.lastName, 60);
  const phone = asString(input?.donor?.phone, 30);

  if (!firstName || !lastName || !phone) {
    throw ApiError.unprocessable("Vos coordonnées sont incomplètes.", {
      donor: "Prénom, nom et téléphone sont obligatoires.",
    });
  }

  const transactionId = asString(input?.proof?.transactionId, 60);

  if (!transactionId) {
    throw ApiError.unprocessable(
      "Le numéro de transaction Mobile Money est obligatoire.",
      {
        transactionId:
          "Saisissez le numéro reçu par SMS après votre paiement.",
      }
    );
  }

  // Le type et le moyen sont revalidés côté serveur — un navigateur
  // pourrait envoyer un identifiant inactif ou inexistant, obtenu
  // avant qu'un administrateur ne désactive l'entrée entre-temps.
  const [type, method] = await Promise.all([
    DonationType.findOne({ _id: input?.donationTypeId, active: true }),
    PaymentMethod.findOne({ _id: input?.paymentMethodId, active: true }),
  ]);

  if (!type) {
    throw ApiError.unprocessable("Type de don invalide.", {
      donationTypeId: "Choisissez un type de don proposé.",
    });
  }

  if (!method) {
    throw ApiError.unprocessable("Moyen de paiement invalide.", {
      paymentMethodId: "Choisissez un moyen de paiement proposé.",
    });
  }

  const donation = await Donation.create({
    donor: {
      firstName,
      lastName,
      phone,
      email: asString(input?.donor?.email, 160),
    },
    amount,
    donationType: { ref: type._id, name: type.name },
    paymentMethod: { ref: method._id, name: method.name },
    proof: {
      transactionId,
      imageUrl: asString(input?.proof?.imageUrl, 400),
    },
    ip,
  });

  return { reference: donation.reference, status: donation.status };
};

// ------------------------------------------------------------------
// ADMINISTRATION
// ------------------------------------------------------------------

export const adminList = async ({
  status,
  donationType,
  paymentMethod,
  limit = 50,
  page = 1,
} = {}) => {
  const filter = {};

  if (["en_attente", "valide", "rejete"].includes(status)) {
    filter.status = status;
  }

  if (donationType) filter["donationType.ref"] = donationType;
  if (paymentMethod) filter["paymentMethod.ref"] = paymentMethod;

  const perPage = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const current = Math.max(Number(page) || 1, 1);

  const [items, total] = await Promise.all([
    Donation.find(filter)
      .sort({ createdAt: -1 })
      .skip((current - 1) * perPage)
      .limit(perPage)
      .lean(),

    Donation.countDocuments(filter),
  ]);

  return { items, total, page: current, perPage };
};

export const adminSummary = async () => {
  const startOfMonth = new Date();

  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const [totals, monthly] = await Promise.all([
    Donation.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 }, total: { $sum: "$amount" } } },
    ]),

    Donation.aggregate([
      { $match: { status: "valide", reviewedAt: { $gte: startOfMonth } } },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$amount" } } },
    ]),
  ]);

  const byStatus = Object.fromEntries(
    totals.map((row) => [row._id, { count: row.count, total: row.total }])
  );

  return {
    en_attente: byStatus.en_attente ?? { count: 0, total: 0 },
    valide: byStatus.valide ?? { count: 0, total: 0 },
    rejete: byStatus.rejete ?? { count: 0, total: 0 },
    thisMonth: monthly[0]
      ? { count: monthly[0].count, total: monthly[0].total }
      : { count: 0, total: 0 },
  };
};

// Décision finale et irréversible : un don `en_attente` peut devenir
// `valide` ou `rejete`, mais plus jamais rouvert. Un rejet exige une
// remarque — c'est ce que verra le personnel qui recontacte le
// donateur, et ce que l'admin relira en cas de contestation.
export const review = async (id, { decision, note } = {}, user) => {
  if (!["valide", "rejete"].includes(decision)) {
    throw ApiError.badRequest("Décision invalide.");
  }

  const trimmedNote = asString(note, 400);

  if (decision === "rejete" && !trimmedNote) {
    throw ApiError.unprocessable(
      "Une remarque est obligatoire pour rejeter un don.",
      { note: "Expliquez pourquoi ce don est rejeté." }
    );
  }

  const donation = await Donation.findOneAndUpdate(
    { _id: id, status: "en_attente" },
    {
      status: decision,
      adminNote: trimmedNote,
      reviewedBy: user?.id,
      reviewedAt: new Date(),
    },
    { new: true }
  );

  if (!donation) {
    const existing = await Donation.findById(id).lean();

    if (!existing) throw ApiError.notFound("Don introuvable.");

    throw ApiError.conflict(
      `Ce don a déjà été ${existing.status === "valide" ? "validé" : "rejeté"}.`
    );
  }

  return donation;
};

// ------------------------------------------------------------------
// REÇU
// ------------------------------------------------------------------
// Seul un don VALIDÉ donne lieu à un reçu — voir receipt.service.js.
export const receiptFor = async (reference) => {
  const donation = await Donation.findOne({ reference });

  if (!donation) {
    throw ApiError.notFound("Don introuvable.");
  }

  if (donation.status !== "valide") {
    throw ApiError.badRequest(
      donation.status === "en_attente"
        ? "Ce don n'est pas encore vérifié. Le reçu sera disponible dès sa validation."
        : "Aucun reçu ne peut être émis pour cette contribution."
    );
  }

  return donation;
};

export const publicSiteUrl = () => env.PUBLIC_SITE_URL;
