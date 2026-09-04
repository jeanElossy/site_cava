import { apiBaseUrl, getToken, request } from "./http";

// Badgeage des présences — voir docs/superpowers/specs/2026-08-04-
// badgeage-presences-design.md.
//
// STOCKAGE DU JETON DE SESSION AGENT — délibérément `sessionStorage`,
// jamais `localStorage` ni le jeton d'administration (`cava:token`).
// L'appareil utilisé est partagé (téléphone/tablette du Service
// d'Ordre) : la session doit s'effacer à la fermeture de l'onglet, et
// ne doit jamais pouvoir se confondre avec une session admin.
const SESSION_KEY = "cava:presence-session";

export const getPresenceSession = () => {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);

    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setPresenceSession = (session) => {
  try {
    if (session) {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      window.sessionStorage.removeItem(SESSION_KEY);
    }
  } catch {
    /* stockage indisponible */
  }
};

export const clearPresenceSession = () => setPresenceSession(null);

// ---- Authentification agent ---------------------------------------

export const verifyPresenceQr = (token) =>
  request("/api/presences/qr/verify", { method: "POST", body: { token } });

export const presenceAgentLogin = ({ token, matricule }) =>
  request("/api/presences/agent-login", {
    method: "POST",
    body: { token, matricule },
  });

// ---- Scanner (session agent requise) -------------------------------

export const scanMemberCard = (registrationNumber, sessionToken) =>
  request("/api/presences/scan", {
    method: "POST",
    body: { registrationNumber },
    token: sessionToken,
  });

export const searchPresenceMembers = (q, sessionToken) =>
  request(`/api/presences/search?q=${encodeURIComponent(q)}`, {
    token: sessionToken,
  });

export const markPresenceManually = (memberId, sessionToken) =>
  request("/api/presences/mark", {
    method: "POST",
    body: { memberId },
    token: sessionToken,
  });

// `phone` est facultatif mais bien transmis : c'est la coordonnée que
// l'équipe des nouvelles âmes reprend dans le dossier SOA. Elle était
// saisie à l'écran puis perdue en route — le corps de la requête ne la
// portait pas.
export const markVisitorPresence = (
  { firstName, lastName, gender, phone },
  sessionToken
) =>
  request("/api/presences/mark-visitor", {
    method: "POST",
    body: { firstName, lastName, gender, phone },
    token: sessionToken,
  });

// Identité réelle du porteur d'un badge invité pré-imprimé — la
// présence existe déjà (créée au scan), seule son identité fictive est
// remplacée, d'où le PATCH.
export const identifyPresenceVisitor = (
  visitorId,
  { firstName, lastName, phone },
  sessionToken
) =>
  request(`/api/presences/visitors/${visitorId}`, {
    method: "PATCH",
    body: { firstName, lastName, phone },
    token: sessionToken,
  });

export const presenceStats = (sessionToken) =>
  request("/api/presences/stats", { token: sessionToken });

export const listPresenceVisitors = (sessionToken) =>
  request("/api/presences/visitors", { token: sessionToken });

// Même raisonnement que `downloadAttendanceExport` plus bas : la route
// exige un jeton (en-tête `Authorization`), qu'un simple lien
// `<a href>` ne peut pas porter — récupéré en binaire puis transformé
// en URL objet le temps du téléchargement/partage.
export const downloadVisitorsPdf = async (sessionToken) => {
  const response = await fetch(`${apiBaseUrl}/api/presences/visitors.pdf`, {
    headers: { Authorization: `Bearer ${sessionToken ?? ""}` },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);

    throw new Error(payload?.message ?? "Le PDF n'a pas pu être généré.");
  }

  return { blob: await response.blob(), filename: "visiteurs.pdf" };
};

// Feuille de présence COMPLÈTE : membres scannés ET visiteurs, avec les
// totaux. À ne pas confondre avec `downloadVisitorsPdf` ci-dessus, qui
// ne liste que les visiteurs — c'est ce document-là que l'agent archive
// en fin de culte.
export const downloadSessionAttendancePdf = async (sessionToken) => {
  const response = await fetch(`${apiBaseUrl}/api/presences/attendance.pdf`, {
    headers: { Authorization: `Bearer ${sessionToken ?? ""}` },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);

    throw new Error(payload?.message ?? "Le PDF n'a pas pu être généré.");
  }

  return { blob: await response.blob(), filename: "presences.pdf" };
};

// ---- Administration --------------------------------------------------

export const adminListPresenceQrs = () =>
  request("/api/admin/presences/qrcodes", { auth: true });

export const adminGeneratePresenceQr = (payload) =>
  request("/api/admin/presences/qrcodes", {
    method: "POST",
    body: payload,
    auth: true,
  });

export const adminPresenceQrImage = (id) =>
  request(`/api/admin/presences/qrcodes/${id}/image`, { auth: true });

export const adminRevokePresenceQr = (id) =>
  request(`/api/admin/presences/qrcodes/${id}/revoke`, {
    method: "POST",
    auth: true,
  });

// `force` : confirme la destruction des présences déjà enregistrées.
// Sans lui, le serveur refuse et indique combien de lignes seraient
// perdues — c'est ce compte qui est présenté à l'administrateur avant
// qu'il ne confirme.
export const adminDeletePresenceQr = (id, { force = false } = {}) =>
  request(`/api/admin/presences/qrcodes/${id}${force ? "?force=true" : ""}`, {
    method: "DELETE",
    auth: true,
  });

export const adminPresenceQrHistory = (id) =>
  request(`/api/admin/presences/qrcodes/${id}/history`, { auth: true });

export const adminListAttendance = (params = {}) =>
  request(
    `/api/admin/presences/attendance?${new URLSearchParams(params)}`,
    { auth: true }
  );

export const adminAttendanceCounts = (id) =>
  request(`/api/admin/presences/qrcodes/${id}/attendance-counts`, {
    auth: true,
  });

// Récupéré en binaire plutôt que lié directement : la route exige un
// jeton d'administration (en-tête `Authorization`), qu'un simple lien
// `<a href>` ne peut pas porter — même raisonnement que
// `services/donations.js#fetchReceipt`.
const downloadAttendanceExport = async (id, format) => {
  const response = await fetch(
    `${apiBaseUrl}/api/admin/presences/qrcodes/${id}/export.${format}`,
    { headers: { Authorization: `Bearer ${getToken() ?? ""}` } }
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);

    throw new Error(
      payload?.message ?? "L'export n'a pas pu être généré."
    );
  }

  return {
    blob: await response.blob(),
    filename: `presences-${id}.${format}`,
  };
};

export const downloadAttendanceXlsx = (id) => downloadAttendanceExport(id, "xlsx");
export const downloadAttendancePdf = (id) => downloadAttendanceExport(id, "pdf");
