import { Router } from "express";
import mongoose from "mongoose";

import * as childService from "../services/child.service.js";
import * as guardianService from "../services/childGuardian.service.js";
import * as classService from "../services/sundaySchoolClass.service.js";
import * as monitorService from "../services/monitor.service.js";
import * as monitorAccountService from "../services/monitorAccount.service.js";
import * as substitutionService from "../services/substitution.service.js";
import * as documentService from "../services/childDocument.service.js";
import * as attendanceService from "../services/childAttendance.service.js";
import AuditLog from "../models/AuditLog.js";

import * as statsService from "../services/childStats.service.js";
import * as audit from "../services/audit.service.js";

import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { sendSuccess, sendCreated, sendNoContent } from "../utils/respond.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { asString } from "../middlewares/sanitize.js";

// Administration du module Enfants — /api/admin/enfants.
//
// Routeur sur-mesure, comme le Service Social et les Dons : la logique
// (numéro de dossier, accès par classe, documents protégés) est trop
// spécifique pour le CRUD générique `resourceRouter`.

// Gestion courante du module.
const CHILDREN_ADMIN_ROLES = ["admin", "responsable_ecole_dimanche"];

// Actions réservées à l'administrateur, plus étroit que ci-dessus :
// tout ce qui touche aux COMPTES et aux mots de passe. Le responsable
// de l'École du dimanche gère les enfants et les classes, il ne
// distribue pas les accès — même découpage que « Moyens de paiement »
// pour les dons, ou « Types d'aide » pour le social.
const ACCESS_ADMIN_ROLES = ["admin"];

const parsePositiveInt = (value) => {
  const n = Number(value);

  return Number.isInteger(n) && n > 0 ? n : undefined;
};

const parseAge = (value) => {
  const n = Number(value);

  return Number.isInteger(n) && n >= 0 && n <= 25 ? n : undefined;
};

export const buildChildrenRouter = () => {
  const router = Router();

  router.use(requireAuth, requireRole(...CHILDREN_ADMIN_ROLES));

  // Un `:id` de ce routeur designe TOUJOURS un enfant.
  //
  // Garde-fou d'ordre de routage : `router.use("/seances", ...)` ne
  // repond qu'au POST, donc un GET sur ce chemin traverse le montage
  // sans handler et poursuit jusqu'aux routes `/:id` declarees plus
  // bas. Sans ce controle, `Child.findById("seances")` levait un
  // CastError rendu en « Identifiant invalide. » — un message qui
  // n'apprend rien et qui a fait passer un defaut d'ordre pour un
  // probleme de donnees.
  //
  // Le refus est donc un 404 explicite, et tout chemin litteral ajoute
  // plus tard sans verbe correspondant echouera lisiblement.
  router.param("id", (req, _res, next, value) => {
    if (!mongoose.isValidObjectId(value)) {
      return next(ApiError.notFound("Enfant introuvable."));
    }

    next();
  });

  // ---- Tableau de bord ------------------------------------------
  router.get(
    "/dashboard",
    asyncHandler(async (req, res) =>
      sendSuccess(res, {
        data: await statsService.dashboard({
          church: parsePositiveInt(req.query.church),
        }),
      })
    )
  );

  // ---- Enfants ---------------------------------------------------
  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const { items, meta } = await childService.list({
        page: req.query.page,
        limit: req.query.limit,
        search: asString(req.query.search, 80),
        classId: asString(req.query.classId, 40),
        church: parsePositiveInt(req.query.church),
        status: asString(req.query.status, 20),
        gender: asString(req.query.gender, 20),
        ageMin: parseAge(req.query.ageMin),
        ageMax: parseAge(req.query.ageMax),
        guardianId: asString(req.query.guardianId, 40),
        incompleteOnly: req.query.incompleteOnly === "true",
      });

      sendSuccess(res, { data: items, meta });
    })
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const data = await childService.create(req.body ?? {}, req.user);

      await audit.record(req, {
        action: "create",
        resource: "child",
        resourceId: data.id ?? data._id,
      });

      sendCreated(res, { message: "Enfant enregistré.", data });
    })
  );


  // ---- Responsables (annuaire) -----------------------------------
  const guardians = Router();

  guardians.get(
    "/",
    asyncHandler(async (req, res) => {
      const { items, meta } = await guardianService.list({
        search: asString(req.query.search, 80),
        church: parsePositiveInt(req.query.church),
        page: req.query.page,
        limit: req.query.limit,
      });

      sendSuccess(res, { data: items, meta });
    })
  );

  guardians.post(
    "/",
    asyncHandler(async (req, res) => {
      const data = await guardianService.create(req.body ?? {}, req.user);

      await audit.record(req, {
        action: "create",
        resource: "childGuardian",
        resourceId: data.id ?? data._id,
      });

      sendCreated(res, { message: "Responsable enregistré.", data });
    })
  );

  guardians.get(
    "/:id",
    asyncHandler(async (req, res) =>
      sendSuccess(res, { data: await guardianService.getById(req.params.id) })
    )
  );

  guardians.get(
    "/:id/enfants",
    asyncHandler(async (req, res) =>
      sendSuccess(res, { data: await guardianService.childrenOf(req.params.id) })
    )
  );

  guardians.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      const data = await guardianService.update(req.params.id, req.body ?? {});

      await audit.record(req, {
        action: "update",
        resource: "childGuardian",
        resourceId: req.params.id,
      });

      sendSuccess(res, { message: "Responsable mis à jour.", data });
    })
  );

  guardians.delete(
    "/:id",
    requireRole(...ACCESS_ADMIN_ROLES),
    asyncHandler(async (req, res) => {
      await guardianService.remove(req.params.id);

      await audit.record(req, {
        action: "delete",
        resource: "childGuardian",
        resourceId: req.params.id,
      });

      sendNoContent(res);
    })
  );

  router.use("/responsables", guardians);

  // ---- Classes ---------------------------------------------------
  const classes = Router();

  classes.get(
    "/",
    asyncHandler(async (req, res) =>
      sendSuccess(res, {
        data: await classService.list({
          church: parsePositiveInt(req.query.church),
          status: asString(req.query.status, 20),
          search: asString(req.query.search, 80),
        }),
      })
    )
  );

  classes.post(
    "/",
    asyncHandler(async (req, res) => {
      const data = await classService.create(req.body ?? {}, req.user);

      await audit.record(req, {
        action: "create",
        resource: "childClass",
        resourceId: data.id ?? data._id,
      });

      sendCreated(res, { message: "Classe créée.", data });
    })
  );

  classes.get(
    "/:id",
    asyncHandler(async (req, res) =>
      sendSuccess(res, { data: await classService.getById(req.params.id) })
    )
  );

  classes.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      const data = await classService.update(req.params.id, req.body ?? {});

      await audit.record(req, {
        action: "update",
        resource: "childClass",
        resourceId: req.params.id,
      });

      sendSuccess(res, { message: "Classe mise à jour.", data });
    })
  );

  // Archivage, pas suppression — voir sundaySchoolClass.service.js.
  classes.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      await classService.archive(req.params.id);

      await audit.record(req, {
        action: "update",
        resource: "childClassArchive",
        resourceId: req.params.id,
      });

      sendNoContent(res);
    })
  );

  router.use("/classes", classes);

  // ---- Moniteurs -------------------------------------------------
  const monitors = Router();

  monitors.get(
    "/",
    asyncHandler(async (req, res) =>
      sendSuccess(res, {
        data: await monitorService.list({
          church: parsePositiveInt(req.query.church),
          classId: asString(req.query.classId, 40),
          status: asString(req.query.status, 20),
          search: asString(req.query.search, 80),
        }),
      })
    )
  );

  // Recherche de membres a nommer moniteur.
  //
  // Declaree AVANT `/:id` et `/:memberId/acces` : « membres » est un
  // chemin litteral, il doit gagner sur les chemins parametres du meme
  // routeur (voir le lot 10 du suivi).
  monitors.get(
    "/membres",
    asyncHandler(async (req, res) =>
      sendSuccess(res, {
        data: await monitorService.searchAssignableMembers({
          search: asString(req.query.search, 80),
          church: parsePositiveInt(req.query.church),
        }),
      })
    )
  );

  monitors.post(
    "/",
    asyncHandler(async (req, res) => {
      const data = await monitorService.assign(req.body ?? {}, req.user);

      await audit.record(req, {
        action: "create",
        resource: "monitorAssignment",
        resourceId: data.id,
      });

      sendCreated(res, { message: "Fonction de moniteur attribuée.", data });
    })
  );

  monitors.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      const data = await monitorService.update(req.params.id, req.body ?? {});

      await audit.record(req, {
        action: "update",
        resource: "monitorAssignment",
        resourceId: req.params.id,
      });

      sendSuccess(res, { message: "Affectation mise à jour.", data });
    })
  );

  monitors.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const data = await monitorService.withdraw(req.params.id);

      await audit.record(req, {
        action: "update",
        resource: "monitorAssignmentWithdraw",
        resourceId: req.params.id,
      });

      sendSuccess(res, { message: "Fonction retirée. Le membre reste inchangé.", data });
    })
  );

  // ---- Accès moniteur (comptes et mots de passe) -----------------
  //
  // Réservé à l'administrateur, y compris au sein du module : le
  // responsable de l'École du dimanche affecte les moniteurs, il ne
  // distribue pas les accès.
  monitors.post(
    "/:memberId/acces",
    requireRole(...ACCESS_ADMIN_ROLES),
    asyncHandler(async (req, res) => {
      const result = await monitorAccountService.openAccess(
        {
          memberId: req.params.memberId,
          password: req.body?.password,
          role: req.body?.role,
        },
        req.user
      );

      // Le journal retient QUE l'accès a été ouvert, jamais le mot de
      // passe : `audit.record` n'enregistre que l'acteur, l'action et
      // la ressource — c'est précisément pour ça qu'on ne lui passe
      // aucun détail ici.
      await audit.record(req, {
        action: "create",
        resource: "monitorAccount",
        resourceId: result.account.id,
      });

      sendCreated(res, {
        message:
          "Accès créé. Communiquez ce mot de passe au moniteur : il ne sera plus jamais affiché.",
        data: result,
      });
    })
  );

  monitors.post(
    "/acces/:accountId/reinitialiser",
    requireRole(...ACCESS_ADMIN_ROLES),
    asyncHandler(async (req, res) => {
      const result = await monitorAccountService.resetPassword(req.params.accountId, {
        password: req.body?.password,
      });

      await audit.record(req, {
        action: "password_change",
        resource: "monitorAccount",
        resourceId: req.params.accountId,
      });

      sendSuccess(res, {
        message:
          "Mot de passe réinitialisé. La session en cours du moniteur est immédiatement coupée.",
        data: result,
      });
    })
  );

  monitors.patch(
    "/acces/:accountId/statut",
    requireRole(...ACCESS_ADMIN_ROLES),
    asyncHandler(async (req, res) => {
      const data = await monitorAccountService.setActive(
        req.params.accountId,
        req.body?.isActive
      );

      await audit.record(req, {
        action: "update",
        resource: "monitorAccount",
        resourceId: req.params.accountId,
      });

      sendSuccess(res, { message: "Accès mis à jour.", data });
    })
  );

  monitors.delete(
    "/acces/:accountId",
    requireRole(...ACCESS_ADMIN_ROLES),
    asyncHandler(async (req, res) => {
      const data = await monitorAccountService.revokeAccess(req.params.accountId);

      await audit.record(req, {
        action: "update",
        resource: "monitorAccountRevoke",
        resourceId: req.params.accountId,
      });

      sendSuccess(res, {
        message: "Accès retiré. Le compte et la fiche membre sont conservés.",
        data,
      });
    })
  );

  router.use("/moniteurs", monitors);

  // ---- Remplacements ---------------------------------------------
  const substitutions = Router();

  substitutions.get(
    "/",
    asyncHandler(async (req, res) =>
      sendSuccess(res, {
        data: await substitutionService.list({
          church: parsePositiveInt(req.query.church),
          classId: asString(req.query.classId, 40),
          monitorId: asString(req.query.monitorId, 40),
          state: asString(req.query.state, 20),
        }),
      })
    )
  );

  substitutions.post(
    "/",
    asyncHandler(async (req, res) => {
      const data = await substitutionService.create(req.body ?? {}, req.user);

      await audit.record(req, {
        action: "substitution_create",
        resource: "monitorSubstitution",
        resourceId: data.id,
      });

      sendCreated(res, { message: "Remplacement enregistré.", data });
    })
  );

  substitutions.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      const data = await substitutionService.update(req.params.id, req.body ?? {});

      // Modifier les dates d'un remplacement change rétroactivement qui
      // avait accès ce jour-là. C'est acceptable pour un outil interne,
      // mais ça doit rester tracé — sans quoi une correction de dates
      // deviendrait un moyen silencieux de justifier un accès passé.
      await audit.record(req, {
        action: "substitution_create",
        resource: "monitorSubstitutionUpdate",
        resourceId: req.params.id,
      });

      sendSuccess(res, { message: "Remplacement mis à jour.", data });
    })
  );

  substitutions.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const data = await substitutionService.cancel(req.params.id, {
        reason: req.body?.reason,
      });

      await audit.record(req, {
        action: "substitution_cancel",
        resource: "monitorSubstitution",
        resourceId: req.params.id,
      });

      sendSuccess(res, { message: "Remplacement annulé.", data });
    })
  );

  router.use("/remplacements", substitutions);

  // ---- Séances et présences (vue administration) -----------------
  const sessions = Router();

  // Liste des seances, toutes classes confondues.
  //
  // Declaree EN PREMIER dans ce sous-routeur, et surtout presente :
  // sans verbe GET sur "/", un GET /seances traversait le montage sans
  // handler et poursuivait jusqu'aux routes `/:id` du routeur parent.
  sessions.get(
    "/",
    asyncHandler(async (req, res) => {
      const { items, meta } = await attendanceService.listSessions({
        church: parsePositiveInt(req.query.church),
        classId: asString(req.query.classId, 40),
        from: asString(req.query.from, 30),
        to: asString(req.query.to, 30),
        page: req.query.page,
        limit: req.query.limit,
      });

      sendSuccess(res, { data: items, meta });
    })
  );

  sessions.post(
    "/",
    asyncHandler(async (req, res) => {
      const { session, created } = await attendanceService.openSession(req.body ?? {}, {
        user: req.user,
      });

      if (created) {
        await audit.record(req, {
          action: "create",
          resource: "childSession",
          resourceId: session.id ?? session._id,
        });
      }

      sendCreated(res, {
        message: created ? "Séance planifiée." : "Séance déjà planifiée pour ce jour.",
        data: session,
      });
    })
  );

  sessions.get(
    "/:id/appel",
    asyncHandler(async (req, res) =>
      sendSuccess(res, { data: await attendanceService.rollCall(req.params.id) })
    )
  );

  sessions.get(
    "/:id/statistiques",
    asyncHandler(async (req, res) =>
      sendSuccess(res, { data: await attendanceService.sessionStats(req.params.id) })
    )
  );

  router.use("/seances", sessions);

  // ---- Historique (journal d'audit du module) --------------------
  //
  // Lit `AuditLog` en le RESTREIGNANT aux ressources du module : sans
  // ce filtre, cet écran donnerait au responsable de l'École du
  // dimanche une vue sur tout le journal de l'administration —
  // connexions, dons, Service Social compris.
  const CHILDREN_RESOURCES = [
    "child",
    "childStatus",
    "childClass",
    "childClassArchive",
    "childGuardian",
    "childGuardianLink",
    "childDocument",
    "childAttendance",
    "childSession",
    "monitorAssignment",
    "monitorAssignmentWithdraw",
    "monitorAccount",
    "monitorAccountRevoke",
    "monitorSubstitution",
    "monitorSubstitutionUpdate",
  ];

  router.get(
    "/historique",
    asyncHandler(async (req, res) => {
      const page = Math.max(Number(req.query.page) || 1, 1);
      const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);

      const filter = { resource: { $in: CHILDREN_RESOURCES } };

      const action = asString(req.query.action, 40);

      if (action) filter.action = action;

      const [items, total] = await Promise.all([
        AuditLog.find(filter)
          .populate("actor", "name role registrationNumber email")
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        AuditLog.countDocuments(filter),
      ]);

      sendSuccess(res, {
        data: items,
        meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
      });
    })
  );

  // ---- Fiche d un enfant -----------------------------------------
  //
  // DECLARE EN DERNIER, ET CE N EST PAS UN DETAIL DE PRESENTATION.
  //
  // Express resout les routes dans leur ordre de declaration. Place
  // avant les montages ci-dessus, `/:id` capturait `/classes`,
  // `/moniteurs`, `/remplacements`, `/seances`, `/responsables` et
  // `/historique` : le chemin litteral partait en identifiant, et
  // `Child.findById("remplacements")` levait un CastError rendu au
  // navigateur en « Identifiant invalide ».
  //
  // Toute nouvelle sous-ressource se monte DONC au-dessus de ce bloc.
  // children.routes.test.js verrouille cet ordre.

  router.get(
    "/:id",
    asyncHandler(async (req, res) =>
      sendSuccess(res, { data: await childService.getById(req.params.id) })
    )
  );

  router.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      const data = await childService.update(req.params.id, req.body ?? {});

      await audit.record(req, {
        action: "update",
        resource: "child",
        resourceId: req.params.id,
      });

      sendSuccess(res, { message: "Fiche mise à jour.", data });
    })
  );

  router.patch(
    "/:id/statut",
    asyncHandler(async (req, res) => {
      const data = await childService.setStatus(req.params.id, req.body?.status);

      await audit.record(req, {
        action: "update",
        resource: "childStatus",
        resourceId: req.params.id,
      });

      sendSuccess(res, { message: "Statut mis à jour.", data });
    })
  );

  // Changement de classe — route à part parce qu'elle est tracée
  // séparément : « quand cet enfant a-t-il changé de classe » est une
  // question qu'on pose souvent, et qu'un `update` générique noierait.
  router.patch(
    "/:id/classe",
    asyncHandler(async (req, res) => {
      const data = await childService.assignClass(req.params.id, req.body?.classId);

      await audit.record(req, {
        action: "update",
        resource: "childClass",
        resourceId: req.params.id,
      });

      sendSuccess(res, {
        message: data.warning ?? "Classe mise à jour.",
        data,
      });
    })
  );

  router.get(
    "/:id/presences",
    asyncHandler(async (req, res) => {
      const data = await childService.attendanceHistory(req.params.id, {
        page: req.query.page,
        limit: req.query.limit,
      });

      sendSuccess(res, { data: data.items, meta: data.meta, stats: data.stats });
    })
  );

  // ---- Responsables d'un enfant ----------------------------------
  router.post(
    "/:id/responsables",
    asyncHandler(async (req, res) => {
      const data = await childService.attachGuardian(req.params.id, req.body ?? {});

      await audit.record(req, {
        action: "update",
        resource: "childGuardianLink",
        resourceId: req.params.id,
      });

      sendCreated(res, { message: "Responsable rattaché.", data });
    })
  );

  router.delete(
    "/:id/responsables/:guardianId",
    asyncHandler(async (req, res) => {
      await childService.detachGuardian(req.params.id, req.params.guardianId);

      await audit.record(req, {
        action: "update",
        resource: "childGuardianLink",
        resourceId: req.params.id,
      });

      sendNoContent(res);
    })
  );

  // ---- Documents -------------------------------------------------
  router.get(
    "/:id/documents",
    asyncHandler(async (req, res) =>
      sendSuccess(res, { data: await documentService.list(req.params.id) })
    )
  );

  router.post(
    "/:id/documents",
    asyncHandler(async (req, res) => {
      const author = documentService.authorFromUser(req.user);

      const data = await documentService.attach(req.params.id, req.body ?? {}, author);

      await audit.record(req, {
        action: "document_upload",
        resource: "childDocument",
        resourceId: data.id,
      });

      sendCreated(res, { message: "Document ajouté.", data });
    })
  );

  // CONSULTATION D'UN DOCUMENT SENSIBLE.
  //
  // Délivre une URL signée valable quelques minutes, et JOURNALISE
  // l'accès. C'est cette trace qui permet de répondre, des mois plus
  // tard, à « qui a consulté l'acte de naissance de cet enfant » —
  // exigence explicite du cahier des charges, et seul moyen de repérer
  // une consultation anormale.
  //
  // La journalisation est faite ici plutôt que dans le service : la
  // route dispose de l'adresse IP et du navigateur, que le service
  // ignore (même découpage que partout ailleurs dans le projet).
  router.get(
    "/:id/documents/:documentId/lien",
    asyncHandler(async (req, res) => {
      const data = await documentService.openLink(
        req.params.id,
        req.params.documentId,
        { attachment: req.query.telecharger === "true" }
      );

      await audit.record(req, {
        action: "document_view",
        resource: "childDocument",
        resourceId: req.params.documentId,
      });

      sendSuccess(res, {
        data: { url: data.url, expiresAt: data.expiresAt, name: data.name },
      });
    })
  );

  router.patch(
    "/:id/documents/:documentId/validation",
    asyncHandler(async (req, res) => {
      const data = await documentService.review(
        req.params.id,
        req.params.documentId,
        { status: req.body?.status, note: req.body?.note },
        req.user
      );

      await audit.record(req, {
        action: "update",
        resource: "childDocument",
        resourceId: req.params.documentId,
      });

      sendSuccess(res, { message: "Document mis à jour.", data });
    })
  );

  router.delete(
    "/:id/documents/:documentId",
    requireRole(...ACCESS_ADMIN_ROLES),
    asyncHandler(async (req, res) => {
      await documentService.remove(req.params.id, req.params.documentId);

      await audit.record(req, {
        action: "document_delete",
        resource: "childDocument",
        resourceId: req.params.documentId,
      });

      sendNoContent(res);
    })
  );

  return router;
};
