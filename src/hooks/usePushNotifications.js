import { useCallback, useEffect, useState } from "react";

import { push } from "../services/api";

// Conversion standard de la clé VAPID (base64url) vers le format
// binaire attendu par `PushManager.subscribe` — il n'existe pas
// d'équivalent natif à `atob` pour l'alphabet base64url, d'où ce petit
// bout de code que l'on retrouve identique dans toute intégration Web
// Push.
const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);

  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

const isSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

/**
 * Abonnement aux notifications push de l'administration, un
 * navigateur/appareil à la fois — voir public/sw.js pour la réception,
 * push.service.js côté serveur pour l'envoi.
 *
 * Ce que reçoit un compte dépend de son rôle (nouveau dossier SOA,
 * transmission à la CANA, suivi à venir — voir newSoul.service.js) :
 * ce hook ne fait qu'activer/désactiver la réception sur CET appareil,
 * il ne choisit rien côté contenu.
 */
const usePushNotifications = () => {
  const [supported] = useState(isSupported);
  const [permission, setPermission] = useState(
    () => (isSupported() ? Notification.permission : "denied")
  );
  const [subscribed, setSubscribed] = useState(false);
  // Pas de chargement à annoncer quand l'appareil ne prend de toute
  // façon pas en charge les notifications — évite un `setLoading`
  // synchrone dans l'effet ci-dessous pour ce cas (voir son commentaire).
  const [loading, setLoading] = useState(supported);
  const [error, setError] = useState("");

  // Chaîne `.then()/.catch()` plutôt qu'une fonction async appelée
  // directement dans l'effet, comme useAsyncData.js : les deux
  // reviennent à mettre à jour l'état après une opération asynchrone,
  // mais seule cette forme échappe à la règle ESLint
  // react-hooks/set-state-in-effect (setState "synchrone" au sens de
  // l'effet, même si l'opération elle-même est asynchrone).
  useEffect(() => {
    if (!supported) return undefined;

    let cancelled = false;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => registration.pushManager.getSubscription())
      .then((existing) => {
        if (!cancelled) setSubscribed(Boolean(existing));
      })
      // Un enregistrement de service worker qui échoue (navigateur
      // restrictif, extension bloquante...) dégrade juste la
      // fonctionnalité : pas d'erreur bruyante pour un confort optionnel.
      .catch(() => {
        if (!cancelled) setSubscribed(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [supported]);

  const enable = useCallback(async () => {
    if (!supported) {
      setError("Les notifications ne sont pas prises en charge sur cet appareil.");

      return;
    }

    setError("");
    setLoading(true);

    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== "granted") {
        setError("Autorisation refusée. Activez les notifications dans les réglages du navigateur.");

        return;
      }

      const { publicKey } = await push.vapidPublicKey();

      if (!publicKey) {
        setError("Les notifications push ne sont pas configurées côté serveur.");

        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await push.subscribe(subscription.toJSON());

      setSubscribed(true);
    } catch (caught) {
      setError(caught?.message ?? "Impossible d'activer les notifications.");
    } finally {
      setLoading(false);
    }
  }, [supported]);

  const disable = useCallback(async () => {
    setError("");
    setLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await push.unsubscribe(subscription.endpoint).catch(() => {});
        await subscription.unsubscribe();
      }

      setSubscribed(false);
    } catch (caught) {
      setError(caught?.message ?? "Impossible de désactiver les notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  return { supported, permission, subscribed, loading, error, enable, disable };
};

export default usePushNotifications;
