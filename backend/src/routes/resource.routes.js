import { Router } from "express";

import { asyncHandler } from "../utils/asyncHandler.js";
import { asString } from "../middlewares/sanitize.js";
import * as audit from "../services/audit.service.js";
import {
  sendSuccess,
  sendCreated,
  sendNoContent,
} from "../utils/respond.js";
import {
  requireAuth,
  requireRole,
} from "../middlewares/auth.js";

// Monte les routes standard d'une ressource de contenu.
//
// Séparation stricte :
//   - `/api/<ressource>`        → public, LECTURE SEULE, contenu publié
//   - `/api/admin/<ressource>`  → authentifié, CRUD complet
//
// Les deux ne partagent aucun handler : c'est ce qui garantit qu'un
// brouillon ne peut pas fuiter par la route publique, même après une
// modification distraite.
export const resourceRouter = (service, options = {}) => {
  const {
    // Le public identifie la ressource par slug, l'admin par id.
    publicBySlug = true,
    // Filtres autorisés en public (liste blanche).
    publicFilters = [],
    // Nom de la ressource dans le journal d'audit.
    auditResource = "ressource",
    // Rôle minimal pour ÉCRIRE. Par défaut un éditeur suffit, mais
    // les ressources portant des données personnelles (membres)
    // exigent un administrateur.
    writeRoles = ["admin", "editor"],
  } = options;

  const publicRouter = Router();
  const adminRouter = Router();

  // ---- Public ------------------------------------------------
  publicRouter.get(
    "/",
    asyncHandler(async (req, res) => {
      // Chaque valeur est forcée en chaîne : un paramètre objet
      // deviendrait un opérateur MongoDB une fois passé à Mongoose.
      const filter = {};

      for (const key of publicFilters) {
        const value = asString(req.query[key], 60);

        if (value) filter[key] = value;
      }

      const data = await service.listPublic({
        filter,
        limit: req.query.limit,
      });

      sendSuccess(res, { data });
    })
  );

  if (publicBySlug) {
    publicRouter.get(
      "/:slug",
      asyncHandler(async (req, res) => {
        const data = await service.getPublicBySlug(
          req.params.slug
        );

        sendSuccess(res, { data });
      })
    );
  }

  // ---- Administration ----------------------------------------
  adminRouter.use(requireAuth);

  adminRouter.get(
    "/",
    asyncHandler(async (req, res) => {
      const { items, meta } = await service.listAdmin({
        page: req.query.page,
        limit: req.query.limit,
        status: req.query.status,
        search: req.query.search,
      });

      sendSuccess(res, { data: items, meta });
    })
  );

  adminRouter.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const data = await service.getById(req.params.id);

      sendSuccess(res, { data });
    })
  );

  adminRouter.post(
    "/",
    requireRole(...writeRoles),
    asyncHandler(async (req, res) => {
      const data = await service.create(req.body, req.user);

      await audit.record(req, {
        action: "create",
        resource: auditResource,
        resourceId: data?._id,
      });

      sendCreated(res, {
        message: "Créé avec succès.",
        data,
      });
    })
  );

  adminRouter.patch(
    "/:id",
    requireRole(...writeRoles),
    asyncHandler(async (req, res) => {
      const data = await service.update(
        req.params.id,
        req.body
      );

      await audit.record(req, {
        action: "update",
        resource: auditResource,
        resourceId: req.params.id,
      });

      sendSuccess(res, {
        message: "Mis à jour avec succès.",
        data,
      });
    })
  );

  // Suppression réservée aux administrateurs : un éditeur peut créer
  // et corriger, mais pas effacer définitivement du contenu.
  adminRouter.delete(
    "/:id",
    requireRole("admin"),
    asyncHandler(async (req, res) => {
      await service.remove(req.params.id);

      await audit.record(req, {
        action: "delete",
        resource: auditResource,
        resourceId: req.params.id,
      });

      sendNoContent(res);
    })
  );

  return { publicRouter, adminRouter };
};
