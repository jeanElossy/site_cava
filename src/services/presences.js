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

export const markVisitorPresence = ({ firstName, lastName, phone }, sessionToken) =>
  request("/api/presences/mark-visitor", {
    method: "POST",
    body: { firstName, lastName, phone },
    token: sessionToken,
  });

export const presenceStats = (sessionToken) =>
  request("/api/presences/stats", { token: sessionToken });

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
