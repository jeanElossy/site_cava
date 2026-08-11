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

// Rôles du module Service Social (cotisations, caisse). Comme
// STAFF_ROLES, utilisé à la fois pour filtrer la navigation
// (AdminLayout.jsx), garder les routes (AdminRoutes.jsx) et masquer
// les actions d'écriture dans les pages elles-mêmes — la vraie
// barrière reste côté API (backend/src/routes/social.routes.js).
export const SOCIAL_ROLES = ["admin", "social_admin", "social_agent", "social_approver", "social_viewer"];

// Sous-ensemble de SOCIAL_ROLES autorisé à enregistrer une cotisation
// ou une exonération (social_viewer et social_approver restent en
// lecture seule en Phase 1).
export const SOCIAL_WRITE_ROLES = ["admin", "social_admin", "social_agent"];

// Sous-ensemble de SOCIAL_ROLES autorisé à valider/refuser une demande
// d'aide sociale (Phase 2) — `social_approver` prend ici son premier
// usage concret, aux côtés de social_admin/admin. L'annulation d'une
// aide déjà payée reste réservée à social_admin/admin (voir
// SocialAidsAdmin.jsx), un sous-ensemble encore plus étroit géré
// directement dans la page plutôt que par un quatrième groupe ici.
export const SOCIAL_DECISION_ROLES = ["admin", "social_admin", "social_approver"];

// Comptes dont le Service Social est le SEUL espace (à l'exclusion de
// `admin`, qui garde l'accès complet à tout le reste) — même principe
// qu'AGENT_ROLES pour Nouvelles Âmes : ces comptes se connectent
// depuis leur téléphone comme un agent soa/cana, et doivent atterrir
// directement dans leur module plutôt que sur le tableau de bord
// général (voir Dashboard.jsx et RequireRole.jsx, qui redirigent ces
// rôles vers /admin/social exactement comme AGENT_ROLES est redirigé
// vers /admin/nouvelles-ames).
export const SOCIAL_ONLY_ROLES = ["social_admin", "social_agent", "social_approver", "social_viewer"];
