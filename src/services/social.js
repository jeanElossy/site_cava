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

// ---- Réglages (montant de cotisation + solde initial par église) --

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
    filename: `recu-cotisation-sociale-${id}.pdf`,
  };
};

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
