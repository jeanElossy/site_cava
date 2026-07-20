import { Router } from "express";

import Event from "../models/Event.js";
import Ministry from "../models/Ministry.js";
import Media from "../models/Media.js";
import Member from "../models/Member.js";
import Announcement from "../models/Announcement.js";
import Settings from "../models/Settings.js";
import Message from "../models/Message.js";

import { createCrudService } from "../services/crud.service.js";
import * as authService from "../services/auth.service.js";
import * as messageService from "../services/message.service.js";
import * as audit from "../services/audit.service.js";
import * as publishService from "../services/publish.service.js";

import { resourceRouter } from "./resource.routes.js";

import { asyncHandler } from "../utils/asyncHandler.js";
import {
  sendSuccess,
  sendCreated,
  sendNoContent,
} from "../utils/respond.js";
import {
  requireAuth,
  requireRole,
} from "../middlewares/auth.js";
import {
  loginLimiter,
  contactLimiter,
} from "../middlewares/rateLimit.js";

// ---------------------------------------------------------------
// Services de contenu
// ---------------------------------------------------------------

const events = createCrudService(Event, {
  label: "Événement",
  defaultSort: { startAt: -1 },
  publicSort: { startAt: 1 },
  searchableFields: ["title", "description"],
});

const ministries = createCrudService(Ministry, {
  label: "Ministère",
  defaultSort: { order: 1, title: 1 },
  publicSort: { order: 1, title: 1 },
  searchableFields: ["title", "description"],
});

const medias = createCrudService(Media, {
  label: "Média",
  defaultSort: { publishedAt: -1 },
  publicSort: { publishedAt: -1 },
  searchableFields: ["title", "author"],
});

// Les membres ne sont jamais exposés publiquement : ce sont des
// données personnelles. `publicFilter` impossible à satisfaire pour
// que même une erreur de montage ne les rende pas accessibles.
const members = createCrudService(Member, {
  label: "Membre",
  defaultSort: { lastName: 1, firstName: 1 },
  publicFilter: { _id: null },
  searchableFields: ["firstName", "lastName"],
});

const announcements = createCrudService(Announcement, {
  label: "Annonce",
  defaultSort: { createdAt: -1 },
  searchableFields: ["title", "body"],
});

// ---------------------------------------------------------------
// Assemblage
// ---------------------------------------------------------------

export const buildRoutes = () => {
  const api = Router();

  api.get("/health", (_req, res) =>
    sendSuccess(res, {
      data: { status: "ok", at: new Date().toISOString() },
    })
  );

  // ---- Authentification --------------------------------------
  const auth = Router();

  auth.post(
    "/login",
    loginLimiter,
    asyncHandler(async (req, res) => {
      const email = req.body?.email;

      let data;

      try {
        data = await authService.login(req.body ?? {});
      } catch (error) {
        await audit.recordLoginAttempt(req, {
          email,
          success: false,
        });

        throw error;
      }

      await audit.recordLoginAttempt(req, {
        email,
        success: true,
        actorId: data.user.id,
      });

      sendSuccess(res, { message: "Connexion réussie.", data });
    })
  );

  auth.get(
    "/me",
    requireAuth,
    asyncHandler(async (req, res) =>
      sendSuccess(res, { data: req.user })
    )
  );

  auth.post(
    "/change-password",
    requireAuth,
    asyncHandler(async (req, res) => {
      await authService.changePassword(
        req.user.id,
        req.body ?? {}
      );

      await audit.record(req, {
        action: "password_change",
      });

      sendSuccess(res, {
        message: "Mot de passe mis à jour.",
      });
    })
  );

  api.use("/auth", auth);

  // ---- Ressources de contenu ---------------------------------
  const mount = (path, service, options) => {
    const { publicRouter, adminRouter } = resourceRouter(
      service,
      options
    );

    api.use(`/${path}`, publicRouter);
    api.use(`/admin/${path}`, adminRouter);
  };

  mount("events", events, { auditResource: "event" });
  mount("ministries", ministries, {
    auditResource: "ministry",
  });
  mount("medias", medias, {
    publicBySlug: false,
    publicFilters: ["category"],
    auditResource: "media",
  });
  mount("announcements", announcements, {
    publicBySlug: false,
    auditResource: "announcement",
  });

  // Les membres portent des données personnelles : leur écriture est
  // réservée aux administrateurs, un éditeur n'y touche pas.
  mount("members", members, {
    publicBySlug: false,
    auditResource: "member",
    writeRoles: ["admin"],
  });

  // ---- Messages ----------------------------------------------
  // Seule route publique en ÉCRITURE de toute l'API.
  api.post(
    "/messages",
    contactLimiter,
    asyncHandler(async (req, res) => {
      const data = await messageService.submit(req.body ?? {});

      sendCreated(res, {
        message:
          "Votre message a bien été reçu. Notre équipe vous répondra.",
        data,
      });
    })
  );

  const adminMessages = Router();

  adminMessages.use(requireAuth);

  adminMessages.get(
    "/",
    asyncHandler(async (req, res) => {
      const { items, meta } = await messageService.listAdmin(
        req.query
      );

      sendSuccess(res, { data: items, meta });
    })
  );

  adminMessages.get(
    "/:id",
    asyncHandler(async (req, res) =>
      sendSuccess(res, {
        data: await messageService.getById(req.params.id),
      })
    )
  );

  adminMessages.patch(
    "/:id/status",
    asyncHandler(async (req, res) =>
      sendSuccess(res, {
        message: "Statut mis à jour.",
        data: await messageService.setStatus(
          req.params.id,
          req.body?.status
        ),
      })
    )
  );

  adminMessages.post(
    "/:id/replies",
    asyncHandler(async (req, res) => {
      // L'audit est écrit APRÈS l'enregistrement réussi : tracer une
      // action qui a ensuite échoué produirait un journal mensonger.
      const data = await messageService.reply(req.params.id, {
        body: req.body?.body,
        user: req.user,
      });

      await audit.record(req, {
        action: "reply",
        resource: "message",
        resourceId: req.params.id,
      });

      sendCreated(res, {
        message:
          "Réponse enregistrée. Aucun e-mail n'a été envoyé : l'envoi automatique n'est pas encore branché.",
        data,
      });
    })
  );

  adminMessages.delete(
    "/:id",
    requireRole("admin"),
    asyncHandler(async (req, res) => {
      await messageService.remove(req.params.id);

      sendNoContent(res);
    })
  );

  api.use("/admin/messages", adminMessages);

  // ---- Paramètres du site ------------------------------------
  api.get(
    "/settings",
    asyncHandler(async (_req, res) => {
      const doc = await Settings.getSite();

      sendSuccess(res, { data: doc.toJSON() });
    })
  );

  api.patch(
    "/admin/settings",
    requireAuth,
    requireRole("admin"),
    asyncHandler(async (req, res) => {
      // `key` et `_id` sont retirés : la clé du singleton est
      // immuable, et l'identifiant ne se réécrit pas depuis une
      // requête.
      const patch = { ...(req.body ?? {}) };

      delete patch.key;
      delete patch._id;

      const doc = await Settings.findOneAndUpdate(
        { key: "site" },
        { ...patch, updatedBy: req.user.id },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        }
      );

      await audit.record(req, {
        action: "settings_update",
        resource: "settings",
      });

      sendSuccess(res, {
        message: "Paramètres enregistrés.",
        data: doc.toJSON(),
      });
    })
  );

  // ---- Publication du site public ----------------------------
  // Déclenche une reconstruction : c'est ce qui rend les
  // modifications visibles sur le site.
  api.post(
    "/admin/publish",
    requireAuth,
    requireRole("admin"),
    asyncHandler(async (req, res) => {
      const data = await publishService.publish();

      await audit.record(req, {
        action: "settings_update",
        resource: "publish",
      });

      sendSuccess(res, {
        message:
          "Publication lancée. Le site sera à jour dans une à deux minutes.",
        data,
      });
    })
  );

  // ---- Tableau de bord ---------------------------------------
  api.get(
    "/admin/stats",
    requireAuth,
    asyncHandler(async (_req, res) => {
      const [
        eventCount,
        ministryCount,
        mediaCount,
        memberCount,
        inboxTotal,
        inboxUnread,
      ] = await Promise.all([
        Event.countDocuments(),
        Ministry.countDocuments(),
        Media.countDocuments(),
        Member.countDocuments(),
        Message.countDocuments(),
        Message.countDocuments({ status: "nouveau" }),
      ]);

      sendSuccess(res, {
        data: {
          events: eventCount,
          ministries: ministryCount,
          medias: mediaCount,
          members: memberCount,
          inboxTotal,
          inboxUnread,
        },
      });
    })
  );

  return api;
};
