import crypto from "node:crypto";

import { env } from "../../config/env.js";
import { ApiError } from "../../utils/ApiError.js";

// Adaptateur CinetPay.
//
// ------------------------------------------------------------------
// PÉRIMÈTRE
// ------------------------------------------------------------------
// Ce fichier est le SEUL à connaître CinetPay. Le reste du code parle
// de « prestataire » à travers les trois fonctions exportées ici. Le
// jour où l'église change d'agrégateur, c'est ce fichier qu'on
// remplace, pas le service de dons ni les routes.
//
// CinetPay est un guichet hébergé : le donateur quitte notre site,
// paie chez eux, revient. Aucune coordonnée bancaire ne transite par
// notre serveur — c'est délibéré, voir le commentaire du modèle
// Donation.

const TIMEOUT_MS = 20000;

// Correspondance entre nos identifiants de moyen de paiement et les
// canaux CinetPay.
//
// CinetPay ne distingue pas les opérateurs à l'initiation : il expose
// « MOBILE_MONEY » et « CREDIT_CARD », puis laisse le donateur choisir
// son opérateur sur son guichet. On transmet donc le canal, et on
// conserve le choix initial de notre côté à titre indicatif.
const CHANNEL_BY_METHOD = {
  orange: "MOBILE_MONEY",
  mtn: "MOBILE_MONEY",
  moov: "MOBILE_MONEY",
  wave: "MOBILE_MONEY",
  card: "CREDIT_CARD",
};

const request = async (path, body) => {
  const controller = new AbortController();

  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;

  try {
    response = await fetch(`${env.CINETPAY_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    // Panne réseau ou délai dépassé. Message volontairement neutre :
    // le donateur n'a pas à lire une erreur technique, et le détail
    // reste dans les journaux du serveur.
    throw ApiError.badRequest(
      "Le service de paiement est momentanément injoignable. Merci de réessayer dans un instant.",
      { cause: error.name }
    );
  } finally {
    clearTimeout(timer);
  }

  const payload = await response.json().catch(() => null);

  if (!payload) {
    throw ApiError.badRequest(
      "Réponse illisible du service de paiement."
    );
  }

  return payload;
};

// ------------------------------------------------------------------
// INITIATION
// ------------------------------------------------------------------
// Renvoie l'URL du guichet vers laquelle rediriger le donateur.
//
// `transaction_id` est NOTRE référence : c'est elle que CinetPay nous
// renverra dans la notification, et elle qui nous permet de retrouver
// le don sans jamais faire confiance à un montant transmis par le
// navigateur.
export const initiatePayment = async (donation) => {
  const payload = await request("/payment", {
    apikey: env.CINETPAY_API_KEY,
    site_id: env.CINETPAY_SITE_ID,

    transaction_id: donation.reference,
    amount: donation.amount,
    currency: donation.currency,

    description: `Contribution ${donation.contributionType} - CAVA`,

    // Serveur à serveur : c'est la SEULE source de vérité pour marquer
    // un don payé. L'URL de retour du navigateur ne l'est pas, car le
    // donateur peut fermer son onglet avant d'y arriver — ou la forger.
    notify_url: `${env.PUBLIC_API_URL}/api/donations/webhook`,

    // Retour du donateur dans son navigateur, pour affichage seulement.
    return_url: `${env.PUBLIC_SITE_URL}/donate/retour?ref=${donation.reference}`,

    channels: CHANNEL_BY_METHOD[donation.paymentMethod] ?? "ALL",

    // CinetPay exige le nom et le téléphone du client pour les
    // paiements par carte. Pour un don anonyme, ces champs sont
    // absents : le paiement par carte sera alors refusé par le
    // prestataire, ce que le tunnel signale en amont.
    customer_name: donation.donor?.firstName || undefined,
    customer_surname: donation.donor?.lastName || undefined,
    customer_phone_number: donation.donor?.phone || undefined,
    customer_email: donation.donor?.email || undefined,

    metadata: donation.project,
  });

  // CinetPay répond 201 avec un code applicatif dans le corps.
  if (payload.code !== "201" || !payload.data?.payment_url) {
    throw ApiError.badRequest(
      "Le paiement n'a pas pu être initialisé. Merci de réessayer ou de choisir un autre moyen de paiement.",
      { providerCode: payload.code, providerMessage: payload.message }
    );
  }

  return {
    paymentUrl: payload.data.payment_url,
    providerToken: payload.data.payment_token ?? null,
  };
};

// ------------------------------------------------------------------
// VÉRIFICATION
// ------------------------------------------------------------------
// Interroge CinetPay sur l'état réel d'une transaction.
//
// C'EST L'ÉTAPE QUI FAIT FOI. La notification reçue sur le webhook est
// traitée comme un simple signal « va vérifier », jamais comme une
// preuve de paiement : son contenu vient du réseau et pourrait être
// fabriqué. Seule cette réponse, obtenue par un appel sortant vers un
// domaine que nous choisissons, établit qu'un don a été payé.
export const verifyPayment = async (reference) => {
  const payload = await request("/payment/check", {
    apikey: env.CINETPAY_API_KEY,
    site_id: env.CINETPAY_SITE_ID,
    transaction_id: reference,
  });

  const data = payload.data ?? {};

  // « 00 » = succès. Tout le reste est un échec ou une attente.
  const accepted = payload.code === "00";

  return {
    accepted,

    // Montant et devise RÉELLEMENT constatés chez le prestataire, à
    // comparer avec ce que nous avions enregistré.
    amount: Number(data.amount),
    currency: data.currency,

    providerTransactionId: data.payment_token ?? data.operator_id ?? null,
    paidWith: data.payment_method ?? null,

    // Encore en cours de traitement chez l'opérateur : ni payé, ni
    // échoué. Rejouer plus tard plutôt que de conclure trop tôt.
    pending: payload.code === "662" || data.status === "PENDING",

    reason: accepted ? null : (payload.message ?? data.status ?? "REFUSÉ"),

    raw: payload,
  };
};

// ------------------------------------------------------------------
// AUTHENTICITÉ DE LA NOTIFICATION
// ------------------------------------------------------------------
// CinetPay signe chaque notification par un HMAC-SHA256 placé dans
// l'en-tête `x-token`, calculé sur la concaténation — dans un ordre
// imposé — des champs du corps.
//
// La comparaison utilise `timingSafeEqual` : une comparaison classique
// (`===`) s'arrête au premier caractère différent, et le temps de
// réponse révèle alors combien de caractères initiaux étaient corrects.
// De quoi reconstituer une signature valide octet par octet.
const SIGNATURE_FIELDS = [
  "cpm_site_id",
  "cpm_trans_id",
  "cpm_trans_date",
  "cpm_amount",
  "cpm_currency",
  "signature",
  "payment_method",
  "cel_phone_num",
  "cpm_phone_prefixe",
  "cpm_language",
  "cpm_version",
  "cpm_payment_config",
  "cpm_page_action",
  "cpm_custom",
  "cpm_designation",
  "cpm_error_message",
];

export const isAuthenticNotification = (body, token) => {
  if (!token || typeof token !== "string") return false;

  // Sans clé, aucune notification ne peut être authentique.
  //
  // Ce cas n'est pas théorique : tant que le compte marchand n'est pas
  // ouvert, la variable est absente en production. `createHmac` lève
  // alors une TypeError, et le webhook répondait 500 au lieu de 401 —
  // constaté sur le serveur déployé.
  //
  // Deux conséquences, toutes deux fâcheuses : le code de retour
  // trahissait qu'une signature avait été fournie (une requête sans
  // jeton recevait 401, une requête avec jeton recevait 500), et le
  // jour où la clé serait vidée par erreur, chaque notification
  // échouerait en boucle sans que rien ne dise pourquoi.
  if (!env.CINETPAY_SECRET_KEY) return false;

  const data = SIGNATURE_FIELDS.map((field) => body?.[field] ?? "").join("");

  const expected = crypto
    .createHmac("sha256", env.CINETPAY_SECRET_KEY)
    .update(data)
    .digest("hex");

  const received = Buffer.from(token, "utf8");
  const computed = Buffer.from(expected, "utf8");

  // `timingSafeEqual` exige des longueurs égales — une différence de
  // longueur est déjà un rejet, et la tester d'abord évite l'exception.
  if (received.length !== computed.length) return false;

  return crypto.timingSafeEqual(received, computed);
};

// Référence de notre don telle que CinetPay la renvoie dans sa
// notification. Isolée ici pour que le service n'ait pas à connaître
// le nom des champs du prestataire.
export const referenceFromNotification = (body) =>
  typeof body?.cpm_trans_id === "string" ? body.cpm_trans_id : null;
