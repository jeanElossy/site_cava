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

// Fabrique de collection : les 5 ressources partagent le même contrat.
const collection = (path) => ({
  // Lecture publique — ne renvoie que le contenu publié.
  list: async (params = {}) => {
    const query = new URLSearchParams(params).toString();

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
    const query = new URLSearchParams({
      limit: 100,
      ...params,
    });

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
      `/api/admin/${path}?${new URLSearchParams(params)}`,
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
// Tableau de bord
// ---------------------------------------------------------------

export const stats = async () =>
  request("/api/admin/stats", { auth: true });
