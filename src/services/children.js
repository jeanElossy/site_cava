// Module Enfants — appels de l'ADMINISTRATION (/admin/enfants).
//
// L'espace moniteur a son propre service (services/monitor.js) : deux
// publics, deux jeux de routes, et surtout deux périmètres de données.
// Les mélanger ferait tôt ou tard passer un appel d'administration
// depuis l'espace moniteur, où il échouerait — ou pire, réussirait.

import { request, requestWithMeta } from "./http";

const query = (params = {}) => {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;

    search.set(key, String(value));
  }

  const string = search.toString();

  return string ? `?${string}` : "";
};

// ---- Enfants -------------------------------------------------------

export const listChildren = (params) =>
  requestWithMeta(`/api/admin/enfants${query(params)}`, { auth: true });

export const getChild = (id) =>
  request(`/api/admin/enfants/${id}`, { auth: true });

export const createChild = (body) =>
  request("/api/admin/enfants", { method: "POST", body, auth: true });

export const updateChild = (id, body) =>
  request(`/api/admin/enfants/${id}`, { method: "PATCH", body, auth: true });

export const setChildStatus = (id, status) =>
  request(`/api/admin/enfants/${id}/statut`, {
    method: "PATCH",
    body: { status },
    auth: true,
  });

export const assignChildClass = (id, classId) =>
  request(`/api/admin/enfants/${id}/classe`, {
    method: "PATCH",
    body: { classId },
    auth: true,
  });

export const childAttendance = (id, params) =>
  requestWithMeta(`/api/admin/enfants/${id}/presences${query(params)}`, {
    auth: true,
  });

// ---- Responsables --------------------------------------------------

export const listGuardians = (params) =>
  requestWithMeta(`/api/admin/enfants/responsables${query(params)}`, {
    auth: true,
  });

export const getGuardian = (id) =>
  request(`/api/admin/enfants/responsables/${id}`, { auth: true });

export const guardianChildren = (id) =>
  request(`/api/admin/enfants/responsables/${id}/enfants`, { auth: true });

export const createGuardian = (body) =>
  request("/api/admin/enfants/responsables", {
    method: "POST",
    body,
    auth: true,
  });

export const updateGuardian = (id, body) =>
  request(`/api/admin/enfants/responsables/${id}`, {
    method: "PATCH",
    body,
    auth: true,
  });

export const deleteGuardian = (id) =>
  request(`/api/admin/enfants/responsables/${id}`, {
    method: "DELETE",
    auth: true,
  });

export const attachGuardian = (childId, body) =>
  request(`/api/admin/enfants/${childId}/responsables`, {
    method: "POST",
    body,
    auth: true,
  });

export const detachGuardian = (childId, guardianId) =>
  request(`/api/admin/enfants/${childId}/responsables/${guardianId}`, {
    method: "DELETE",
    auth: true,
  });

// ---- Classes -------------------------------------------------------

export const listClasses = (params) =>
  request(`/api/admin/enfants/classes${query(params)}`, { auth: true });

export const getClass = (id) =>
  request(`/api/admin/enfants/classes/${id}`, { auth: true });

export const createClass = (body) =>
  request("/api/admin/enfants/classes", { method: "POST", body, auth: true });

export const updateClass = (id, body) =>
  request(`/api/admin/enfants/classes/${id}`, {
    method: "PATCH",
    body,
    auth: true,
  });

// Archivage, pas suppression : une classe supprimée laisserait ses
// séances et ses présences rattachées à rien.
export const archiveClass = (id) =>
  request(`/api/admin/enfants/classes/${id}`, { method: "DELETE", auth: true });

// ---- Moniteurs -----------------------------------------------------

export const listMonitors = (params) =>
  request(`/api/admin/enfants/moniteurs${query(params)}`, { auth: true });

// Membres que l'on peut nommer moniteur. Recherche cloisonnée au
// module : ne renvoie que de quoi identifier une personne, et rien
// tant que la saisie fait moins de deux caractères.
export const searchAssignableMembers = (params) =>
  request(`/api/admin/enfants/moniteurs/membres${query(params)}`, {
    auth: true,
  });

export const assignMonitor = (body) =>
  request("/api/admin/enfants/moniteurs", {
    method: "POST",
    body,
    auth: true,
  });

export const updateMonitor = (id, body) =>
  request(`/api/admin/enfants/moniteurs/${id}`, {
    method: "PATCH",
    body,
    auth: true,
  });

export const withdrawMonitor = (id) =>
  request(`/api/admin/enfants/moniteurs/${id}`, {
    method: "DELETE",
    auth: true,
  });

// ---- Accès moniteur ------------------------------------------------
//
// ⚠️ `openMonitorAccess` et `resetMonitorPassword` renvoient un
// `temporaryPassword` en clair. C'est le SEUL moment où il existe :
// il n'est ni relisible, ni journalisé. L'écran doit l'afficher une
// fois, en invitant à le communiquer immédiatement — ne jamais le
// stocker, même en mémoire de composant plus longtemps que l'affichage.

export const openMonitorAccess = (memberId, body) =>
  request(`/api/admin/enfants/moniteurs/${memberId}/acces`, {
    method: "POST",
    body,
    auth: true,
  });

export const resetMonitorPassword = (accountId, body) =>
  request(`/api/admin/enfants/moniteurs/acces/${accountId}/reinitialiser`, {
    method: "POST",
    body,
    auth: true,
  });

export const setMonitorAccessActive = (accountId, isActive) =>
  request(`/api/admin/enfants/moniteurs/acces/${accountId}/statut`, {
    method: "PATCH",
    body: { isActive },
    auth: true,
  });

export const revokeMonitorAccess = (accountId) =>
  request(`/api/admin/enfants/moniteurs/acces/${accountId}`, {
    method: "DELETE",
    auth: true,
  });

// ---- Remplacements -------------------------------------------------

export const listSubstitutions = (params) =>
  request(`/api/admin/enfants/remplacements${query(params)}`, { auth: true });

export const createSubstitution = (body) =>
  request("/api/admin/enfants/remplacements", {
    method: "POST",
    body,
    auth: true,
  });

export const updateSubstitution = (id, body) =>
  request(`/api/admin/enfants/remplacements/${id}`, {
    method: "PATCH",
    body,
    auth: true,
  });

export const cancelSubstitution = (id, reason) =>
  request(`/api/admin/enfants/remplacements/${id}`, {
    method: "DELETE",
    body: { reason },
    auth: true,
  });

// ---- Séances -------------------------------------------------------

export const listSessions = (params) =>
  requestWithMeta(`/api/admin/enfants/seances${query(params)}`, { auth: true });

export const createSession = (body) =>
  request("/api/admin/enfants/seances", { method: "POST", body, auth: true });

export const sessionRollCall = (id) =>
  request(`/api/admin/enfants/seances/${id}/appel`, { auth: true });

export const sessionStats = (id) =>
  request(`/api/admin/enfants/seances/${id}/statistiques`, { auth: true });

// ---- Documents -----------------------------------------------------

export const listDocuments = (childId) =>
  request(`/api/admin/enfants/${childId}/documents`, { auth: true });

export const attachDocument = (childId, body) =>
  request(`/api/admin/enfants/${childId}/documents`, {
    method: "POST",
    body,
    auth: true,
  });

/**
 * Ouvre un document protégé.
 *
 * Les documents des enfants ne sont JAMAIS servis publiquement : cette
 * route délivre une URL signée valable quelques minutes, et l'accès est
 * journalisé côté serveur. Ne jamais mettre en cache l'URL obtenue —
 * elle expire, et la remettre en circulation contournerait la trace.
 */
export const openDocument = (childId, documentId, { download = false } = {}) =>
  request(
    `/api/admin/enfants/${childId}/documents/${documentId}/lien${query({
      telecharger: download ? "true" : undefined,
    })}`,
    { auth: true }
  );

export const reviewDocument = (childId, documentId, body) =>
  request(`/api/admin/enfants/${childId}/documents/${documentId}/validation`, {
    method: "PATCH",
    body,
    auth: true,
  });

export const deleteDocument = (childId, documentId) =>
  request(`/api/admin/enfants/${childId}/documents/${documentId}`, {
    method: "DELETE",
    auth: true,
  });

export const childrenDashboard = (params) =>
  request(`/api/admin/enfants/dashboard${query(params)}`, { auth: true });

// ---- Historique ----------------------------------------------------
//
// Le journal d'audit, RESTREINT aux ressources du module côté serveur :
// cet écran ne donne jamais accès aux traces des autres modules
// (connexions, dons, Service Social).
export const childrenHistory = (params) =>
  requestWithMeta(`/api/admin/enfants/historique${query(params)}`, {
    auth: true,
  });
