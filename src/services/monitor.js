// Espace moniteur — appels de /monitorat.
//
// Distinct de services/children.js, et pas seulement par commodité :
// ces routes renvoient une vue RESTREINTE, bornée aux classes que le
// moniteur encadre à l'instant de l'appel. Un moniteur n'obtient
// jamais la liste complète des enfants, ni les documents, ni les
// coordonnées des responsables.
//
// Le jeton est le MÊME que celui de l'administration (`cava:token`) :
// un moniteur est un compte ordinaire, authentifié par la route de
// connexion habituelle. C'est l'API qui restreint, pas un second
// mécanisme d'authentification.

import { request } from "./http";

export const monitorProfile = () =>
  request("/api/monitorat/me", { auth: true });

export const monitorClasses = () =>
  request("/api/monitorat/classes", { auth: true });

export const monitorChildren = (classId) =>
  request(`/api/monitorat/classes/${classId}/enfants`, { auth: true });

export const monitorSessions = () =>
  request("/api/monitorat/seances", { auth: true });

export const openMonitorSession = (classId, body) =>
  request(`/api/monitorat/classes/${classId}/seances`, {
    method: "POST",
    body,
    auth: true,
  });

export const monitorRollCall = (sessionId) =>
  request(`/api/monitorat/seances/${sessionId}/appel`, { auth: true });

/**
 * Enregistre l'appel COMPLET en un seul envoi.
 *
 * Volontairement une seule requête pour toute la classe : vingt-quatre
 * allers-retours depuis un téléphone, un dimanche matin, laisseraient
 * l'appel à moitié enregistré à la première coupure — sans que le
 * moniteur sache lesquels sont passés.
 *
 * L'opération est idempotente côté serveur (index unique
 * `{enfant, séance}`) : réessayer après une coupure ne crée aucun
 * doublon.
 */
export const submitRollCall = (sessionId, entries) =>
  request(`/api/monitorat/seances/${sessionId}/appel`, {
    method: "POST",
    body: { entries },
    auth: true,
  });

// « Tous présents » : la liste est construite côté SERVEUR, le
// téléphone n'envoie qu'une intention.
export const markAllPresent = (sessionId) =>
  request(`/api/monitorat/seances/${sessionId}/tous-presents`, {
    method: "POST",
    auth: true,
  });

export const correctAttendance = (sessionId, childId, body) =>
  request(`/api/monitorat/seances/${sessionId}/appel/${childId}`, {
    method: "PATCH",
    body,
    auth: true,
  });

export const monitorSubstitutions = () =>
  request("/api/monitorat/remplacements", { auth: true });
