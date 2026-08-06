// Service worker minimal, dédié aux notifications push de
// l'administration (agents SOA/CANA) — voir src/hooks/usePushNotifications.js
// pour l'enregistrement et l'abonnement.
//
// Volontairement sans mise en cache ni gestion du hors-ligne : le site
// n'est pas une PWA, ce fichier ne sert qu'à recevoir des pushs quand
// aucun onglet n'est ouvert (obligatoire côté navigateur, l'API Push
// n'existe qu'à travers un service worker).

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;

  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const { title, body, url } = payload;

  event.waitUntil(
    self.registration.showNotification(title ?? "CAVA — Administration", {
      body,
      icon: "/images/media/LOGO-CAVA.png",
      badge: "/images/media/LOGO-CAVA.png",
      data: { url: url ?? "/admin" },
    })
  );
});

// Fait passer au premier plan un onglet déjà ouvert sur cette adresse
// plutôt que d'en ouvrir un nouveau, si un existe déjà.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? "/admin";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        const clientUrl = new URL(client.url);

        if (clientUrl.pathname === targetUrl && "focus" in client) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
