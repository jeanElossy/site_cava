import ChildSession from "../models/ChildSession.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  findMemberForAccount,
  resolveClassAccess,
  resolveMonitorAccess,
} from "../services/monitor.service.js";

// Authentification de l'espace moniteur.
//
// ------------------------------------------------------------------
// AUCUN NOUVEAU JETON
// ------------------------------------------------------------------
// Contrairement au badgeage des présences (presenceAuth.js), ce module
// n'introduit PAS de portée de jeton supplémentaire : un moniteur est
// un `User` ordinaire, authentifié par `requireAuth` comme n'importe
// quel compte d'administration. Ce middleware s'exécute APRÈS lui et
// ne fait qu'une chose de plus — retrouver le MEMBRE derrière le
// compte, puis les classes auxquelles il a droit.
//
// ------------------------------------------------------------------
// LE CHEMIN EN TROIS TEMPS
// ------------------------------------------------------------------
//   User (compte)  →  registrationNumber  →  Member (personne)
//                                              ↓
//                                        MonitorAssignment (fonction)
//
// C'est la conséquence directe du choix de ne jamais dupliquer
// l'identité : le compte sert à se connecter, le membre EST la
// personne, et la fonction vit à côté des deux.
export const MONITOR_ROLES = ["moniteur", "responsable_ecole_dimanche"];

// Rôles qui voient TOUTES les classes sans affectation — ils
// administrent le module, ils n'y encadrent pas une classe.
export const CHILDREN_ADMIN_ROLES = ["admin", "responsable_ecole_dimanche"];

export const requireMonitor = asyncHandler(async (req, _res, next) => {
  if (!req.user) {
    throw ApiError.unauthorized("Authentification requise.");
  }

  if (![...MONITOR_ROLES, "admin"].includes(req.user.role)) {
    throw ApiError.forbidden("Votre rôle ne permet pas d'accéder à l'espace moniteur.");
  }

  const member = await findMemberForAccount(req.user);

  // Un compte moniteur dont la fiche membre a été supprimée ou dont le
  // matricule a changé n'ouvre plus rien. On refuse plutôt que de
  // continuer avec une identité partielle : sans membre, il n'y a ni
  // affectation, ni remplacement, ni auteur à inscrire sur une
  // présence.
  if (!member) {
    throw ApiError.forbidden(
      "Votre compte n'est rattaché à aucune fiche membre. Contactez l'administration."
    );
  }

  req.monitor = {
    memberId: String(member._id),
    firstName: member.firstName,
    lastName: member.lastName,
    photo: member.photo,
    registrationNumber: member.registrationNumber,
    church: member.church,
  };

  next();
});

// Charge les classes accessibles MAINTENANT, et les pose sur la
// requête. À utiliser après `requireMonitor`.
export const attachMonitorAccess = asyncHandler(async (req, _res, next) => {
  req.monitorAccess = await resolveMonitorAccess(req.monitor.memberId);

  next();
});

// Déduit la classe à partir d'une SÉANCE, et la pose dans
// `req.params.classId` pour que `requireClassAccess` la trouve.
//
// ------------------------------------------------------------------
// À CHAÎNER, JAMAIS À APPELER À LA MAIN
// ------------------------------------------------------------------
// La tentation est d'invoquer `requireClassAccess` depuis l'intérieur
// d'un handler, en lui passant une callback. C'est un piège : ce
// middleware est un `asyncHandler`, qui signale un refus en appelant
// `next(erreur)` — une callback qui ignore son premier argument
// s'exécute alors comme si l'accès avait été accordé, et la route
// répond 200 sur une classe interdite.
//
// C'est exactement le défaut qu'a révélé le test « passer par
// l'identifiant d'une séance ne contourne pas le contrôle de classe ».
// D'où ce middleware séparé, à chaîner normalement :
//
//   router.get(path, resolveClassFromSession(), requireClassAccess(), handler)
export const resolveClassFromSession = (param = "sessionId") =>
  asyncHandler(async (req, _res, next) => {
    const session = await ChildSession.findById(req.params[param])
      .select("class")
      .lean();

    if (!session) throw ApiError.notFound("Séance introuvable.");

    // La classe vient de la SÉANCE, jamais du client : sans ça, un
    // identifiant de séance appartenant à une autre classe suffirait à
    // en obtenir la liste d'appel.
    req.params.classId = String(session.class);

    next();
  });

// Garde d'accès à UNE classe précise, désignée par `req.params[param]`.
//
// ------------------------------------------------------------------
// POURQUOI CE CONTRÔLE EST REFAIT À CHAQUE REQUÊTE
// ------------------------------------------------------------------
// L'accès d'un moniteur à une seconde classe est borné dans le temps.
// Le vérifier une fois à la connexion laisserait la porte ouverte
// jusqu'à l'expiration du jeton — sept jours pour un remplacement d'un
// dimanche. Ici, chaque requête recalcule : le lendemain, la même
// requête échoue, sans qu'aucune tâche de fond ait eu à passer.
//
// L'administration du module (`admin`, `responsable_ecole_dimanche`)
// n'est pas soumise à cette règle : elle n'encadre pas une classe, elle
// les gère toutes.
export const requireClassAccess = (param = "classId") =>
  asyncHandler(async (req, _res, next) => {
    const classId = req.params[param] ?? req.body?.[param];

    if (!classId) {
      throw ApiError.badRequest("Classe non précisée.");
    }

    if (CHILDREN_ADMIN_ROLES.includes(req.user?.role)) {
      req.classAccess = { allowed: true, via: "administration", substitution: null };

      return next();
    }

    const access = await resolveClassAccess(req.monitor.memberId, classId);

    if (!access.allowed) {
      // Message volontairement identique pour « cette classe n'est pas
      // la vôtre » et « votre remplacement a expiré » : distinguer les
      // deux apprendrait à un moniteur quelles autres classes existent
      // et jusqu'à quand ses accès ont couru.
      throw ApiError.forbidden("Vous n'encadrez pas cette classe aujourd'hui.");
    }

    req.classAccess = access;

    next();
  });
