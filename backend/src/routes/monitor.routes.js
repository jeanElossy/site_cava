import { Router } from "express";

import ChildSession from "../models/ChildSession.js";
import Child from "../models/Child.js";

import * as attendanceService from "../services/childAttendance.service.js";
import * as substitutionService from "../services/substitution.service.js";
import * as audit from "../services/audit.service.js";

import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess, sendCreated } from "../utils/respond.js";
import { requireAuth } from "../middlewares/auth.js";
import {
  attachMonitorAccess,
  requireClassAccess,
  requireMonitor,
  resolveClassFromSession,
} from "../middlewares/monitorAuth.js";

// Espace moniteur — /api/monitorat.
//
// ------------------------------------------------------------------
// LE MONITEUR NE CHOISIT JAMAIS SA CLASSE PAR UN PARAMÈTRE
// ------------------------------------------------------------------
// Chaque route qui touche à une classe passe par `requireClassAccess`,
// qui recalcule les droits à l'instant de la requête. Un identifiant de
// classe envoyé « à la main » ne donne donc rien de plus que ce que le
// serveur aurait accordé de toute façon — et un remplacement expiré la
// veille échoue, même si l'écran est resté ouvert.

export const buildMonitorRouter = () => {
  const router = Router();

  router.use(requireAuth, requireMonitor);

  // ---- Accueil ---------------------------------------------------
  router.get(
    "/me",
    attachMonitorAccess,
    asyncHandler(async (req, res) => {
      const { assignment, substitutions } = req.monitorAccess;

      sendSuccess(res, {
        data: {
          monitor: req.monitor,
          role: req.user.role,
          primaryClass: assignment?.primaryClass ?? null,
          // Uniquement les remplacements EN COURS aujourd'hui —
          // `resolveMonitorAccess` a déjà écarté les autres. L'écran
          // affiche « Aucun remplacement aujourd'hui » quand la liste
          // est vide, plutôt qu'une liste de remplacements passés qui
          // laisserait croire à un accès.
          substitutions: substitutions.map((item) => ({
            id: String(item._id),
            class: item.class,
            replacedMonitor: item.replacedMonitor ?? null,
            reason: item.reason,
          })),
        },
      });
    })
  );

  // Classes accessibles MAINTENANT, chacune étiquetée.
  router.get(
    "/classes",
    attachMonitorAccess,
    asyncHandler(async (req, res) => {
      const { assignment, substitutions } = req.monitorAccess;

      const items = [];

      if (assignment?.primaryClass) {
        const childCount = await Child.countDocuments({
          currentClass: assignment.primaryClass._id,
          status: "actif",
        });

        items.push({
          class: assignment.primaryClass,
          kind: "principale",
          childCount,
          replacedMonitor: null,
        });
      }

      for (const substitution of substitutions) {
        const childCount = await Child.countDocuments({
          currentClass: substitution.class._id,
          status: "actif",
        });

        items.push({
          class: substitution.class,
          kind: "remplacement",
          childCount,
          replacedMonitor: substitution.replacedMonitor ?? null,
          substitutionId: String(substitution._id),
        });
      }

      sendSuccess(res, { data: items });
    })
  );

  // ---- Enfants d'une classe --------------------------------------
  router.get(
    "/classes/:classId/enfants",
    requireClassAccess("classId"),
    asyncHandler(async (req, res) => {
      const children = await Child.find({
        currentClass: req.params.classId,
        status: "actif",
      })
        // Le moniteur voit ce qu'il lui faut pour faire l'appel et
        // reconnaître un enfant. Ni documents, ni notes médicales, ni
        // coordonnées des responsables : ce n'est pas son rôle, et le
        // cahier des charges le lui interdit explicitement.
        .select("fileNumber firstName lastName photo dateOfBirth")
        .sort({ firstName: 1, lastName: 1 })
        .lean({ virtuals: true });

      sendSuccess(res, { data: children, via: req.classAccess.via });
    })
  );

  // ---- Séances ---------------------------------------------------
  router.get(
    "/seances",
    attachMonitorAccess,
    asyncHandler(async (req, res) => {
      const { classIds } = req.monitorAccess;

      // Les séances des classes accessibles AUJOURD'HUI. Un
      // remplacement expiré retire donc aussi les séances de la classe
      // remplacée : il serait incohérent de continuer à les lister
      // alors que l'appel y est refusé.
      const sessions = await ChildSession.find({ class: { $in: classIds } })
        .populate("class", "name icon room")
        .sort({ date: -1 })
        .limit(50)
        .lean();

      sendSuccess(res, { data: sessions });
    })
  );

  // Ouvre (ou retrouve) la séance du jour. Idempotent : deux moniteurs
  // qui appuient en même temps obtiennent la même séance.
  router.post(
    "/classes/:classId/seances",
    requireClassAccess("classId"),
    asyncHandler(async (req, res) => {
      const { session, created } = await attendanceService.openSession(
        {
          classId: req.params.classId,
          date: req.body?.date,
          type: req.body?.type,
          theme: req.body?.theme,
        },
        { monitorId: req.monitor.memberId, user: req.user }
      );

      sendCreated(res, {
        message: created ? "Séance ouverte." : "Séance déjà ouverte.",
        data: session,
      });
    })
  );

  // La classe est déduite de la séance PUIS vérifiée, en deux
  // middlewares chaînés. Ne jamais appeler `requireClassAccess` depuis
  // l'intérieur d'un handler : un refus s'y traduit par `next(erreur)`,
  // qu'une callback maison ignorerait — voir le commentaire de
  // `resolveClassFromSession`.
  router.get(
    "/seances/:sessionId/appel",
    resolveClassFromSession("sessionId"),
    requireClassAccess("classId"),
    asyncHandler(async (req, res) =>
      sendSuccess(res, {
        data: await attendanceService.rollCall(req.params.sessionId),
      })
    )
  );

  // ENREGISTREMENT DE L'APPEL — un seul envoi pour toute la classe.
  router.post(
    "/seances/:sessionId/appel",
    resolveClassFromSession("sessionId"),
    requireClassAccess("classId"),
    asyncHandler(async (req, res) => {
      const result = await attendanceService.recordRollCall(
        req.params.sessionId,
        { entries: req.body?.entries },
        { actorMemberId: req.monitor.memberId }
      );

      sendSuccess(res, {
        message: `${result.recorded} présence(s) enregistrée(s).`,
        data: result,
      });
    })
  );

  // « TOUS PRÉSENTS » — la liste est construite côté serveur, le
  // téléphone n'envoie qu'une intention.
  router.post(
    "/seances/:sessionId/tous-presents",
    resolveClassFromSession("sessionId"),
    requireClassAccess("classId"),
    asyncHandler(async (req, res) => {
      const result = await attendanceService.markAllPresent(req.params.sessionId, {
        actorMemberId: req.monitor.memberId,
      });

      sendSuccess(res, {
        message: `${result.recorded} enfant(s) marqué(s) présent(s).`,
        data: result,
      });
    })
  );

  // Correction après coup — tracée, contrairement à la saisie initiale.
  router.patch(
    "/seances/:sessionId/appel/:childId",
    resolveClassFromSession("sessionId"),
    requireClassAccess("classId"),
    asyncHandler(async (req, res) => {
      const result = await attendanceService.correct(
        req.params.sessionId,
        req.params.childId,
        { status: req.body?.status, note: req.body?.note },
        { actorMemberId: req.monitor.memberId }
      );

      // L'ancienne et la nouvelle valeur comptent autant que le fait
      // qu'une correction ait eu lieu : le journal ne stocke pas les
      // valeurs (voir AuditLog.js), mais `resource` porte de quoi les
      // retrouver sur la ligne de présence, qui les conserve.
      await audit.record(req, {
        action: "attendance_update",
        resource: "childAttendance",
        resourceId: `${req.params.sessionId}/${req.params.childId}`,
      });

      sendSuccess(res, { message: "Présence corrigée.", data: result });
    })
  );

  // ---- Remplacements du moniteur ---------------------------------
  router.get(
    "/remplacements",
    asyncHandler(async (req, res) =>
      sendSuccess(res, {
        data: await substitutionService.listForMonitor(req.monitor.memberId),
      })
    )
  );

  return router;
};
