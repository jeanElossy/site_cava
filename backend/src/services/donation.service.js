import Donation from "../models/Donation.js";

import { ApiError } from "../utils/ApiError.js";
import { env, isPaymentConfigured } from "../config/env.js";

import * as provider from "./payment/cinetpay.js";

// Logique métier des dons.
//
// Le fil conducteur : ce que le navigateur envoie ne sert qu'à CRÉER
// l'intention de don. À partir de là, tout ce qui décide qu'un don est
// payé vient d'un appel sortant vers le prestataire, jamais d'une
// requête entrante.

const ALLOWED_METHODS = ["orange", "mtn", "moov", "wave", "card"];

const ALLOWED_TYPES = ["dime", "offrande", "don", "grace", "projet"];

const MIN_AMOUNT = 200;
const MAX_AMOUNT = 10000000;

const asString = (value, max) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

// ------------------------------------------------------------------
// CRÉATION
// ------------------------------------------------------------------

export const createDonation = async (input, { ip } = {}) => {
  if (!isPaymentConfigured()) {
    throw ApiError.badRequest(
      "Les dons en ligne ne sont pas encore activés. Merci de nous contacter pour contribuer autrement."
    );
  }

  const amount = Number(input?.amount);

  // Le montant est le champ le plus sensible du formulaire : c'est lui
  // qui sera débité. On le valide strictement plutôt que de laisser
  // Mongoose le faire, pour renvoyer un message utilisable dans le
  // tunnel.
  if (!Number.isInteger(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    throw ApiError.unprocessable("Le montant du don est invalide.", {
      amount: `Indiquez un montant entier entre ${MIN_AMOUNT} et ${MAX_AMOUNT} F CFA.`,
    });
  }

  const paymentMethod = asString(input?.paymentMethod, 20);

  if (!ALLOWED_METHODS.includes(paymentMethod)) {
    throw ApiError.unprocessable("Moyen de paiement inconnu.", {
      paymentMethod: "Choisissez un moyen de paiement proposé.",
    });
  }

  const contributionType = ALLOWED_TYPES.includes(input?.contributionType)
    ? input.contributionType
    : "don";

  const anonymous = input?.donor?.anonymous === true;

  const donor = {
    anonymous,
    firstName: anonymous ? "" : asString(input?.donor?.firstName, 60),
    lastName: anonymous ? "" : asString(input?.donor?.lastName, 60),
    phone: anonymous ? "" : asString(input?.donor?.phone, 30),
    email: anonymous ? "" : asString(input?.donor?.email, 160),
  };

  // Contrainte du prestataire, pas la nôtre : CinetPay refuse un
  // paiement par carte sans identité ni téléphone. Mieux vaut le dire
  // ici, dans la langue du donateur, que de le laisser découvrir un
  // refus opaque sur le guichet.
  if (paymentMethod === "card" && (anonymous || !donor.firstName || !donor.phone)) {
    throw ApiError.unprocessable(
      "Le paiement par carte demande votre nom et votre téléphone.",
      {
        paymentMethod:
          "Choisissez le mobile money pour donner anonymement, ou renseignez vos coordonnées.",
      }
    );
  }

  const donation = await Donation.create({
    amount,
    paymentMethod,
    contributionType,
    project: asString(input?.project, 60) || "general",
    recurring: input?.recurring === true,
    donor,
    ip,
  });

  let payment;

  try {
    payment = await provider.initiatePayment(donation);
  } catch (error) {
    // L'intention existe en base mais n'ira nulle part : on la marque
    // échouée tout de suite, sinon la liste de l'administration se
    // remplirait de dons « en attente » qui ne se résoudront jamais.
    donation.status = "failed";
    donation.failureReason = "Initialisation refusée par le prestataire.";

    await donation.save();

    throw error;
  }

  if (payment.providerToken) {
    donation.providerTransactionId = payment.providerToken;

    await donation.save();
  }

  return {
    reference: donation.reference,
    amount: donation.amount,
    paymentUrl: payment.paymentUrl,
  };
};

// ------------------------------------------------------------------
// RÉSOLUTION DU STATUT
// ------------------------------------------------------------------
// Appelée par le webhook ET par la page de retour du donateur.
//
// Les deux chemins passent par la même fonction, et pour une bonne
// raison : le donateur revient souvent AVANT que la notification du
// prestataire n'arrive, et il arrive aussi qu'elle n'arrive jamais.
// N'avoir qu'un seul chemin laisserait des dons réellement payés
// bloqués en « en attente ».
//
// L'idempotence repose sur une mise à jour conditionnelle : seule la
// première résolution d'un don « pending » écrit. Les notifications
// répétées de CinetPay — il rejoue jusqu'à recevoir un 200 — et un
// rafraîchissement simultané depuis la page de retour ne peuvent donc
// pas compter le don deux fois.
export const resolveDonation = async (reference) => {
  const donation = await Donation.findOne({ reference });

  if (!donation) {
    throw ApiError.notFound("Don introuvable.");
  }

  // Déjà tranché : rien à revérifier.
  if (donation.status !== "pending") return donation;

  const result = await provider.verifyPayment(reference);

  // L'opérateur n'a pas encore répondu. On ne conclut pas.
  if (result.pending) return donation;

  const update = result.accepted
    ? {
        status: "paid",
        paidAt: new Date(),
        paidWith: result.paidWith ?? undefined,
        providerTransactionId:
          result.providerTransactionId ?? donation.providerTransactionId,
        providerPayload: result.raw,
        confirmedAt: new Date(),
      }
    : {
        status: "failed",
        failureReason: String(result.reason ?? "Paiement refusé.").slice(0, 200),
        providerPayload: result.raw,
        confirmedAt: new Date(),
      };

  // Le prestataire dit « payé », mais pas du montant attendu.
  //
  // On refuse d'enregistrer le don comme réglé : le reçu porterait un
  // montant que personne n'a versé. Le cas est signalé pour traitement
  // manuel plutôt qu'écarté silencieusement.
  if (
    result.accepted &&
    (result.amount !== donation.amount || result.currency !== donation.currency)
  ) {
    update.status = "suspect";
    update.failureReason =
      `Montant confirmé (${result.amount} ${result.currency}) ` +
      `différent du montant attendu (${donation.amount} ${donation.currency}).`;
  }

  // `status: "pending"` dans le filtre : c'est la garde d'idempotence.
  // Si un autre traitement a déjà résolu ce don, la mise à jour ne
  // correspond à rien et n'écrit pas.
  const updated = await Donation.findOneAndUpdate(
    { reference, status: "pending" },
    update,
    { new: true }
  );

  return updated ?? (await Donation.findOne({ reference }));
};

// ------------------------------------------------------------------
// NOTIFICATION DU PRESTATAIRE
// ------------------------------------------------------------------

export const handleNotification = async (body, token) => {
  if (!provider.isAuthenticNotification(body, token)) {
    // Signature absente ou fausse : la requête n'a pas été émise par
    // le prestataire. On ne révèle pas pourquoi elle est rejetée.
    throw ApiError.unauthorized("Notification refusée.");
  }

  const reference = provider.referenceFromNotification(body);

  if (!reference) {
    throw ApiError.badRequest("Notification incomplète.");
  }

  return resolveDonation(reference);
};

// ------------------------------------------------------------------
// LECTURE PUBLIQUE
// ------------------------------------------------------------------
// Ce que la page de retour a le droit de savoir.
//
// Volontairement minimal : ni identité du donateur, ni réponse brute
// du prestataire. La référence circule dans une URL, elle peut donc se
// retrouver dans un historique de navigation ou un journal de serveur.
export const publicStatus = async (reference) => {
  const donation = await resolveDonation(reference);

  return {
    reference: donation.reference,
    status: donation.status,
    amount: donation.amount,
    currency: donation.currency,
    contributionType: donation.contributionType,
    project: donation.project,
    paidAt: donation.paidAt ?? null,
  };
};

// ------------------------------------------------------------------
// STATISTIQUES POUR L'ADMINISTRATION
// ------------------------------------------------------------------

export const adminSummary = async () => {
  const startOfMonth = new Date();

  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const [totals, monthly] = await Promise.all([
    Donation.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 }, total: { $sum: "$amount" } } },
    ]),

    Donation.aggregate([
      { $match: { status: "paid", paidAt: { $gte: startOfMonth } } },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$amount" } } },
    ]),
  ]);

  const byStatus = Object.fromEntries(
    totals.map((row) => [row._id, { count: row.count, total: row.total }])
  );

  return {
    paid: byStatus.paid ?? { count: 0, total: 0 },
    pending: byStatus.pending ?? { count: 0, total: 0 },
    failed: byStatus.failed ?? { count: 0, total: 0 },
    suspect: byStatus.suspect ?? { count: 0, total: 0 },
    thisMonth: monthly[0]
      ? { count: monthly[0].count, total: monthly[0].total }
      : { count: 0, total: 0 },
  };
};

export const adminList = async ({ status, limit = 50, page = 1 } = {}) => {
  const filter = {};

  if (["pending", "paid", "failed", "suspect"].includes(status)) {
    filter.status = status;
  }

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

// Nombre de dons encore en attente au-delà d'un délai raisonnable.
//
// Un guichet abandonné laisse un don « pending » pour toujours. Les
// compter permet à l'administration de voir qu'il y a du ménage à
// faire, plutôt que de laisser la liste se dégrader sans bruit.
export const staleCount = async (hours = 24) => {
  const before = new Date(Date.now() - hours * 3600 * 1000);

  return Donation.countDocuments({
    status: "pending",
    createdAt: { $lt: before },
  });
};

export const paymentEnabled = () => isPaymentConfigured();

export const publicSiteUrl = () => env.PUBLIC_SITE_URL;
