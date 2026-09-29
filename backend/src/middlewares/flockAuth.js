import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { findMemberForAccount } from "../services/account.service.js";
import { resolveFlockAccess } from "../services/flockAccess.service.js";

// Authentification du portail bergerie.
//
// AUCUN NOUVEAU JETON, comme pour l'espace moniteur : un responsable de
// bergerie est un `User` ordinaire, authentifié par `requireAuth`. Ce
// middleware s'exécute APRÈS lui et ne fait qu'une chose de plus —
// retrouver le membre derrière le compte, puis la bergerie qu'il
// dirige.
//
//   User (compte)  →  registrationNumber  →  Member (personne)
//                                              ↓
//                                    Flock.leader (fonction)
export const FLOCK_PORTAL_ROLES = ["responsable_bergerie"];

export const requireFlockLeader = asyncHandler(async (req, _res, next) => {
  if (!req.user) {
    throw ApiError.unauthorized("Authentification requise.");
  }

  if (!FLOCK_PORTAL_ROLES.includes(req.user.role)) {
    throw ApiError.forbidden(
      "Votre rôle ne permet pas d'accéder au portail bergerie."
    );
  }

  const member = await findMemberForAccount(req.user);

  // Un compte dont la fiche membre a disparu, ou dont le matricule a
  // changé, n'ouvre plus rien. On refuse plutôt que de continuer avec
  // une identité partielle : sans membre, il n'y a pas de bergerie à
  // résoudre, et la requête suivante filtrerait sur « rien » — ce qui
  // se lit comme un portail vide, pas comme un problème de compte.
  if (!member) {
    throw ApiError.forbidden(
      "Votre compte n'est rattaché à aucune fiche membre. Contactez l'administration."
    );
  }

  const access = await resolveFlockAccess(member._id);

  if (!access.flock) {
    throw ApiError.forbidden(
      "Vous n'êtes responsable d'aucune bergerie active. Contactez l'administration."
    );
  }

  req.flockLeader = {
    memberId: String(member._id),
    firstName: member.firstName,
    lastName: member.lastName,
    registrationNumber: member.registrationNumber,
  };

  // Posé sur la requête par le SERVEUR, à partir du compte connecté.
  // Jamais lu depuis `req.query` ni `req.params` : un filtre passé en
  // paramètre se réécrit d'un clic dans la barre d'adresse, et le
  // responsable de la bergerie OL verrait la liste nominative de la
  // bergerie ME.
  req.flockAccess = access;

  next();
});
