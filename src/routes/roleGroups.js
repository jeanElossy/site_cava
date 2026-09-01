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

// ---- Module Enfants / École du dimanche ---------------------------

// Rôles qui ADMINISTRENT le module (enfants, classes, moniteurs,
// remplacements). Miroir exact de `CHILDREN_ADMIN_ROLES` côté API
// (backend/src/routes/children.routes.js) — la vraie barrière reste
// là-bas, comme toujours.
export const CHILDREN_ROLES = ["admin", "responsable_ecole_dimanche"];

// Sous-ensemble autorisé à ouvrir un accès moniteur et à réinitialiser
// un mot de passe. Le responsable de l'École du dimanche affecte les
// moniteurs, il ne distribue pas les accès — même découpage que
// « Moyens de paiement » pour les dons.
export const CHILDREN_ACCESS_ROLES = ["admin"];

// Comptes dont l'espace moniteur est le SEUL espace (à l'exclusion de
// `admin` et du responsable, qui gardent l'administration) — même
// principe qu'AGENT_ROLES pour Nouvelles Âmes et SOCIAL_ONLY_ROLES
// pour le Service Social : ces comptes se connectent depuis leur
// téléphone et doivent atterrir directement dans /monitorat, jamais
// sur le tableau de bord général.
export const MONITOR_ONLY_ROLES = ["moniteur"];

// Rôles qui peuvent entrer dans l'espace moniteur. Le responsable y
// entre aussi : il encadre parfois une classe, et doit pouvoir faire
// l'appel comme les autres.
export const MONITOR_ROLES = ["moniteur", "responsable_ecole_dimanche", "admin"];
