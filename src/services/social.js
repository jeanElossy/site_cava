import { apiBaseUrl, getToken, request, requestWithMeta } from "./http";

// Accès au module Service Social (cotisations, caisse, dashboard).
//
// Miroir de services/donations.js, mais tout est authentifié : ce
// module vit entièrement dans l'espace d'administration, il n'existe
// aucune route publique correspondante (contrairement aux dons, dont
// le formulaire est public).

// `new URLSearchParams({ a: undefined })` ne l'omet PAS : il produit
// littéralement `a=undefined`. Un filtre optionnel non renseigné doit
// être absent de l'objet, pas valoir `undefined`/`""` (même piège que
// services/api.js#cleanParams).
const cleanParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== ""
    )
  );

const qs = (params) => new URLSearchParams(cleanParams(params)).toString();

// ---- Réglages (montant de cotisation par église) ------------------
//
// Le solde de caisse n'est plus un réglage d'église : il appartient à
// un exercice annuel (voir la section « Exercices » plus bas).

export const fetchSocialSettings = () =>
  request("/api/admin/social/settings", { auth: true });

export const updateSocialSettings = (church, payload) =>
  request(`/api/admin/social/settings/${church}`, {
    method: "PATCH",
    body: payload,
    auth: true,
  });

// ---- Membres ------------------------------------------------------

export const searchSocialMembers = (params = {}) =>
  request(`/api/admin/social/members/search?${qs(params)}`, { auth: true });

export const fetchMemberSocialFile = (memberId) =>
  request(`/api/admin/social/members/${memberId}/fiche`, { auth: true });

// ---- Cotisations ----------------------------------------------------

export const recordSocialPayments = (payload) =>
  request("/api/admin/social/contributions", {
    method: "POST",
    body: payload,
    auth: true,
  });

export const fetchSocialContributions = (params = {}) =>
  requestWithMeta(`/api/admin/social/contributions?${qs(params)}`, {
    auth: true,
  });

export const fetchUnpaidContributions = (params = {}) =>
  request(`/api/admin/social/contributions/impayes?${qs(params)}`, {
    auth: true,
  });

export const exemptContribution = (id, motif) =>
  request(`/api/admin/social/contributions/${id}/exonerer`, {
    method: "PATCH",
    body: { motif },
    auth: true,
  });

// Le reçu est récupéré en binaire, PAS via un lien direct : la route
// est authentifiée (contrairement au reçu de don, public par
// référence), donc le jeton doit voyager dans l'en-tête `Authorization`
// — un simple <a href> ne peut pas le porter. Même pattern que
// services/donations.js#fetchReceipt, avec le jeton en plus.
export const fetchContributionReceipt = async (id) => {
  const token = getToken();

  const response = await fetch(
    `${apiBaseUrl}/api/admin/social/contributions/${id}/recu`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);

    throw new Error(payload?.message ?? "Le reçu n'a pas pu être généré.");
  }

  return {
    blob: await response.blob(),
    filename: `recu-offrande-sociale-${id}.pdf`,
  };
};

// ---- Exercices annuels de la caisse ---------------------------------
//
// Une caisse par église ET par année. `fetchSocialCaisse` et
// `fetchSocialLedger` prennent donc un paramètre `year` : sans lui, la
// caisse 2027 afficherait aussi les mouvements de 2024.

export const fetchSocialExercices = (params = {}) =>
  request(`/api/admin/social/exercices?${qs(params)}`, { auth: true });

export const openSocialExercice = (payload) =>
  request("/api/admin/social/exercices", {
    method: "POST",
    body: payload,
    auth: true,
  });

// Clôture l'exercice ET ouvre le suivant au solde reporté — c'est le
// serveur qui enchaîne les deux, pour qu'un solde ne puisse jamais se
// perdre entre les deux appels.
export const closeSocialExercice = (church, year) =>
  request(`/api/admin/social/exercices/${church}/${year}/cloturer`, {
    method: "PATCH",
    auth: true,
  });

export const reopenSocialExercice = (church, year) =>
  request(`/api/admin/social/exercices/${church}/${year}/rouvrir`, {
    method: "PATCH",
    auth: true,
  });

// Rattrapage manuel des lignes d'offrande dues (depuis 2024), sans
// attendre le passage du job quotidien. Idempotent côté serveur.
export const generateSocialContributions = (payload = {}) =>
  request("/api/admin/social/contributions/generer", {
    method: "POST",
    body: payload,
    auth: true,
  });

// ---- Caisse ---------------------------------------------------------

export const fetchSocialCaisse = (params = {}) =>
  request(`/api/admin/social/caisse?${qs(params)}`, { auth: true });

export const fetchSocialLedger = (params = {}) =>
  requestWithMeta(`/api/admin/social/caisse/mouvements?${qs(params)}`, {
    auth: true,
  });

// ---- Dashboard --------------------------------------------------------

export const fetchSocialDashboard = (params = {}) =>
  request(`/api/admin/social/dashboard?${qs(params)}`, { auth: true });

// ---- Aides sociales (Phase 2) ---------------------------------------
//
// Les types d'aide (CRUD simple) n'ont pas de wrapper dédié ici : la
// page `SocialAidTypesAdmin.jsx` consomme directement la ressource
// `socialAidTypes` de `services/api.js` (fabrique `collection()`),
// exactement comme `DonationTypesAdmin.jsx` consomme `donationTypes`.

export const fetchSocialAids = (params = {}) =>
  requestWithMeta(`/api/admin/social/aids?${qs(params)}`, { auth: true });

export const createSocialAid = (payload) =>
  request("/api/admin/social/aids", {
    method: "POST",
    body: payload,
    auth: true,
  });

// Décaisse immédiatement (workflow simplifié à 2 étapes — voir le
// document de conception Phase 2) : peut échouer avec un message
// explicite si le solde de la caisse de l'église du bénéficiaire est
// insuffisant, recalculé côté serveur.
export const validateSocialAid = (id) =>
  request(`/api/admin/social/aids/${id}/valider`, {
    method: "PATCH",
    auth: true,
  });

export const refuseSocialAid = (id, motif) =>
  request(`/api/admin/social/aids/${id}/refuser`, {
    method: "PATCH",
    body: { motif },
    auth: true,
  });

export const cancelSocialAid = (id, motif) =>
  request(`/api/admin/social/aids/${id}/annuler`, {
    method: "PATCH",
    body: { motif },
    auth: true,
  });
