// COUTURE UNIQUE ENTRE L'INTERFACE ET LES DONNÉES.
//
// ------------------------------------------------------------------
// BRANCHÉ SUR L'API RÉELLE (backend Express + MongoDB)
// ------------------------------------------------------------------
// Ce fichier exposait auparavant une implémentation factice sur
// localStorage. Sa signature n'a PAS changé : les composants qui le
// consomment n'ont pas été modifiés. C'était l'objectif de la couture.
//
// Configuration : `VITE_API_URL` (voir `.env.example` à la racine).
// En développement, la valeur par défaut est http://localhost:4000.
//
// Conventions de l'API :
//   - lecture publique   : /api/<ressource>        (contenu publié)
//   - CRUD administration : /api/admin/<ressource>  (jeton requis)

import { request, requestWithMeta } from "./http";

// `new URLSearchParams({ a: undefined })` ne l'omet PAS : il produit
// littéralement `a=undefined`, une chaîne non vide que le serveur lit
// comme une vraie valeur de filtre (et qui ne correspond jamais à
// rien, renvoyant silencieusement une liste vide). Un filtre optionnel
// non renseigné doit être absent de l'objet, pas valoir `undefined`.
const cleanParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== ""
    )
  );

// Fabrique de collection : les 5 ressources partagent le même contrat.
const collection = (path) => ({
  // Lecture publique — ne renvoie que le contenu publié.
  list: async (params = {}) => {
    const query = new URLSearchParams(cleanParams(params)).toString();

    return request(`/api/${path}${query ? `?${query}` : ""}`);
  },

  // Lecture d'administration — inclut brouillons et archives.
  //
  // Renvoie un TABLEAU, comme `list`, pour que les écrans puissent
  // passer indifféremment de l'une à l'autre. La limite haute évite
  // qu'un oubli de pagination ne tronque silencieusement la liste à
  // 20 éléments : l'administrateur ne verrait pas son contenu et ne
  // saurait pas pourquoi.
  listAdmin: async (params = {}) => {
    const query = new URLSearchParams(
      cleanParams({ limit: 100, ...params })
    );

    const { items } = await requestWithMeta(
      `/api/admin/${path}?${query}`,
      { auth: true }
    );

    return items;
  },

  // Variante paginée, quand l'écran affiche un compteur ou une
  // navigation entre pages.
  listAdminPaged: async (params = {}) =>
    requestWithMeta(
      `/api/admin/${path}?${new URLSearchParams(cleanParams(params))}`,
      { auth: true }
    ),

  get: async (id) =>
    request(`/api/admin/${path}/${id}`, { auth: true }),

  getPublic: async (slug) => request(`/api/${path}/${slug}`),

  create: async (payload) =>
    request(`/api/admin/${path}`, {
      method: "POST",
      body: payload,
      auth: true,
    }),

  update: async (id, patch) =>
    request(`/api/admin/${path}/${id}`, {
      method: "PATCH",
      body: patch,
      auth: true,
    }),

  remove: async (id) => {
    await request(`/api/admin/${path}/${id}`, {
      method: "DELETE",
      auth: true,
    });

    return true;
  },
});

export const events = collection("events");
export const ministries = collection("ministries");
export const medias = collection("medias");
export const members = collection("members");
export const announcements = collection("announcements");
export const testimonials = collection("testimonials");
export const flocks = collection("flocks");
export const churches = collection("churches");

// ---------------------------------------------------------------
// Inscriptions et mises à jour de fiche membre
// ---------------------------------------------------------------
export const memberSubmissions = {
  // Écriture PUBLIQUE : le formulaire d'inscription du site.
  submit: async (payload) =>
    request("/api/submissions", {
      method: "POST",
      body: payload,
    }),

  // Lecture PUBLIQUE, mais conditionnelle : ne renvoie des données que
  // si le matricule ET le nom de famille correspondent. `data` vaut
  // `null` sans distinction entre « matricule inconnu » et « nom
  // erroné » — voir submission.service.js#lookup côté serveur.
  lookup: async (registrationNumber, lastName) =>
    request("/api/submissions/lookup", {
      method: "POST",
      body: { registrationNumber, lastName },
    }),

  list: async (params = {}) =>
    requestWithMeta(
      `/api/admin/submissions?${new URLSearchParams({
        limit: 50,
        ...params,
      })}`,
      { auth: true }
    ),

  get: async (id) =>
    request(`/api/admin/submissions/${id}`, { auth: true }),

  approve: async (id, overrides) =>
    request(`/api/admin/submissions/${id}/approve`, {
      method: "POST",
      body: { overrides },
      auth: true,
    }),

  reject: async (id, reason) =>
    request(`/api/admin/submissions/${id}/reject`, {
      method: "POST",
      body: { reason },
      auth: true,
    }),
};

// ---------------------------------------------------------------
// Boîte de réception
// ---------------------------------------------------------------

export const inbox = {
  // Écriture PUBLIQUE : le formulaire de contact du site.
  submit: async (payload) =>
    request("/api/messages", {
      method: "POST",
      body: payload,
    }),

  // Renvoie un TABLEAU : c'est ce qu'attendent le tableau de bord et
  // la boîte de réception, qui itèrent directement dessus.
  list: async (params = {}) => {
    const { items } = await requestWithMeta(
      `/api/admin/messages?${new URLSearchParams({
        limit: 100,
        ...params,
      })}`,
      { auth: true }
    );

    return items;
  },

  listPaged: async (params = {}) =>
    requestWithMeta(
      `/api/admin/messages?${new URLSearchParams(params)}`,
      { auth: true }
    ),

  get: async (id) =>
    request(`/api/admin/messages/${id}`, { auth: true }),

  markRead: async (id) =>
    request(`/api/admin/messages/${id}/status`, {
      method: "PATCH",
      body: { status: "lu" },
      auth: true,
    }),

  setStatus: async (id, status) =>
    request(`/api/admin/messages/${id}/status`, {
      method: "PATCH",
      body: { status },
      auth: true,
    }),

  // La réponse est enregistrée côté serveur mais AUCUN e-mail n'est
  // envoyé : aucun service d'envoi n'est branché. L'interface doit
  // continuer à le dire clairement au personnel de l'église.
  reply: async (id, body) =>
    request(`/api/admin/messages/${id}/replies`, {
      method: "POST",
      body: { body },
      auth: true,
    }),

  remove: async (id) => {
    await request(`/api/admin/messages/${id}`, {
      method: "DELETE",
      auth: true,
    });

    return true;
  },
};

// ---------------------------------------------------------------
// Paramètres du site (document unique)
// ---------------------------------------------------------------

// Lettre d'information.
//
// `subscribe` est PUBLIC : c'est, avec le formulaire de contact, la
// seule écriture accessible sans authentification. Le reste est
// réservé à l'administration.
export const newsletter = {
  subscribe: async (email, name) =>
    request("/api/newsletter", {
      method: "POST",
      body: { email, name },
    }),

  unsubscribe: async (token) =>
    request("/api/newsletter/desinscription", {
      method: "POST",
      body: { token },
    }),

  // Renvoie un TABLEAU, comme les autres listes d'administration.
  list: async (params = {}) => {
    const { items } = await requestWithMeta(
      `/api/admin/newsletter?${new URLSearchParams({
        limit: 200,
        ...params,
      })}`,
      { auth: true }
    );

    return items;
  },

  remove: async (id) =>
    request(`/api/admin/newsletter/${id}`, {
      method: "DELETE",
      auth: true,
    }),
};

export const settings = {
  get: async () => request("/api/settings"),

  save: async (patch) =>
    request("/api/admin/settings", {
      method: "PATCH",
      body: patch,
      auth: true,
    }),
};

// ---------------------------------------------------------------
// Publication du site public
// ---------------------------------------------------------------
// Le site est statique : les modifications faites ici ne deviennent
// visibles qu'après une reconstruction. C'est ce que déclenche cet
// appel.
//
// L'URL du webhook n'est PAS connue du navigateur : elle vit dans les
// variables d'environnement du backend. Sinon, n'importe quel visiteur
// pourrait la lire dans le bundle et déclencher des builds à volonté.

export const publish = async () =>
  request("/api/admin/publish", {
    method: "POST",
    auth: true,
  });

// ---------------------------------------------------------------
// Nouvelles âmes (SOA / CANA)
// ---------------------------------------------------------------
// Pas de `collection()` générique : ce module a des actions métier
// dédiées (transmit, acknowledge, close, status) en plus du CRUD de
// base, et deux sous-ressources (`soa`/`cana`) à mettre à jour
// séparément — voir newSoul.service.js côté serveur.
// `token` : outrepasse `auth` (voir `request` dans services/http.js) —
// permet à un agent de badgeage des présences (jeton de session
// distinct, jamais dans `localStorage`) d'appeler les mêmes fonctions
// que l'administration pour démarrer un dossier SOA depuis l'écran de
// scan, sans dupliquer ce module. Omis, ces fonctions se comportent
// exactement comme avant (jeton admin lu depuis `localStorage`).
export const newSouls = {
  // Liste minimale (id + nom) des comptes portant un rôle donné —
  // pour peupler les sélecteurs "responsable"/"coordonnateur".
  listStaff: async (role, token) =>
    request(`/api/admin/new-souls/staff?role=${encodeURIComponent(role)}`, {
      auth: true,
      token,
    }),

  list: async (params = {}, token) => {
    const query = new URLSearchParams(cleanParams(params)).toString();

    return request(`/api/admin/new-souls${query ? `?${query}` : ""}`, {
      auth: true,
      token,
    });
  },

  stats: async (token) => request("/api/admin/new-souls/stats", { auth: true, token }),

  get: async (id, token) => request(`/api/admin/new-souls/${id}`, { auth: true, token }),

  create: async (payload, token) =>
    request("/api/admin/new-souls", {
      method: "POST",
      body: payload,
      auth: true,
      token,
    }),

  updateSoa: async (id, patch, token) =>
    request(`/api/admin/new-souls/${id}/soa`, {
      method: "PATCH",
      body: patch,
      auth: true,
      token,
    }),

  updateCana: async (id, patch) =>
    request(`/api/admin/new-souls/${id}/cana`, {
      method: "PATCH",
      body: patch,
      auth: true,
    }),

  transmit: async (id, token) =>
    request(`/api/admin/new-souls/${id}/transmit`, {
      method: "POST",
      auth: true,
      token,
    }),

  acknowledge: async (id) =>
    request(`/api/admin/new-souls/${id}/acknowledge`, {
      method: "POST",
      auth: true,
    }),

  setStatus: async (id, status, note) =>
    request(`/api/admin/new-souls/${id}/status`, {
      method: "POST",
      body: { status, note },
      auth: true,
    }),

  close: async (id) =>
    request(`/api/admin/new-souls/${id}/close`, {
      method: "POST",
      auth: true,
    }),
};

// ---------------------------------------------------------------
// Tableau de bord
// ---------------------------------------------------------------

export const stats = async () =>
  request("/api/admin/stats", { auth: true });
