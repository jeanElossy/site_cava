import { request } from "./http";

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
