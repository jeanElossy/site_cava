import webpush from "web-push";

import PushSubscription from "../models/PushSubscription.js";
import User from "../models/User.js";
import { env, isPushConfigured } from "../config/env.js";

// RÈGLE, comme audit.service.js : une notification push est un
// confort, jamais une condition de réussite de l'action métier
// (créer un dossier, le transmettre...). Toute fonction ici avale ses
// propres erreurs et journalise, sans jamais les remonter à
// l'appelant.

let configured = false;

const ensureConfigured = () => {
  if (configured || !isPushConfigured()) return;

  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  configured = true;
};

export const vapidPublicKey = () => env.VAPID_PUBLIC_KEY ?? null;

// Upsert par `endpoint` : un navigateur qui se réabonne (ex. après
// avoir effacé ses données) envoie un nouvel abonnement pour le même
// appareil, qui doit remplacer l'ancien plutôt que de le dupliquer.
export const subscribe = async (userId, subscription) => {
  const { endpoint, keys } = subscription ?? {};

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw new Error("Abonnement push invalide.");
  }

  await PushSubscription.findOneAndUpdate(
    { endpoint },
    { user: userId, endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
    { upsert: true, setDefaultsOnInsert: true }
  );
};

export const unsubscribe = async (userId, endpoint) => {
  if (!endpoint) return;

  await PushSubscription.deleteOne({ endpoint, user: userId });
};

// Envoie à TOUS les appareils abonnés d'un compte. Un abonnement que
// le service de push signale comme disparu (404/410 — l'utilisateur a
// désinstallé le navigateur, effacé ses données...) est supprimé au
// passage, plutôt que de réessayer indéfiniment un envoi voué à
// échouer.
export const sendToUser = async (userId, payload) => {
  try {
    ensureConfigured();

    if (!isPushConfigured()) return;

    const subscriptions = await PushSubscription.find({ user: userId }).lean();

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: subscription.keys,
            },
            JSON.stringify(payload)
          );
        } catch (error) {
          if (error.statusCode === 404 || error.statusCode === 410) {
            await PushSubscription.deleteOne({ _id: subscription._id });

            return;
          }

          console.error("[push] envoi impossible :", error.message);
        }
      })
    );
  } catch (error) {
    // Filet de sécurité : même une panne inattendue ici (base
    // indisponible...) ne doit jamais remonter à l'appelant — voir la
    // règle en tête de fichier. Les erreurs d'envoi individuelles sont
    // déjà journalisées ci-dessus ; celle-ci couvre le reste.
    console.error("[push] sendToUser a échoué :", error.message);
  }
};

// Envoie à tous les comptes actifs portant l'un des rôles donnés —
// ex. tous les agents SOA quand un dossier est créé depuis la page
// Présences, sans savoir à l'avance lequel le traitera.
export const sendToRoles = async (roles, payload) => {
  try {
    ensureConfigured();

    if (!isPushConfigured()) return;

    const users = await User.find({ role: { $in: roles }, isActive: true })
      .select("_id")
      .lean();

    await Promise.all(users.map((user) => sendToUser(user._id, payload)));
  } catch (error) {
    console.error("[push] sendToRoles a échoué :", error.message);
  }
};
