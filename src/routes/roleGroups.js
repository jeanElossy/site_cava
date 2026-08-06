// Séparé de RequireRole.jsx : ce dernier ne doit exporter qu'un
// composant, sous peine de désactiver le Fast Refresh de Vite sur tout
// le fichier (règle ESLint react-refresh/only-export-components — voir
// le même principe dans src/context/contributionReducer.js).

// Rôles "agent" du module Nouvelles Âmes : une fois connectés, ils ne
// doivent voir que ce module, jamais le reste de l'administration
// (médias, dons, membres, paramètres…) — voir RequireRole.jsx,
// AdminLayout.jsx (NAV_GROUPS filtré) et backend/src/routes/index.js
// (la vraie protection, côté API).
export const AGENT_ROLES = ["soa", "cana", "coordinateur_bergeries", "pasteur"];

// Rôles à pleine capacité de gestion du site (hors comptes agent
// ci-dessus). Utilisé à la fois dans RequireRole.jsx, AdminRoutes.jsx
// et AdminLayout.jsx, pour que les routes accessibles et les liens du
// menu ne divergent jamais.
export const STAFF_ROLES = ["admin", "editor"];
