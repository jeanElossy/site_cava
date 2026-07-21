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
import * as uploadService from "../services/upload.service.js";
import * as newsletterService from "../services/newsletter.service.js";

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
  twoFactorLimiter,
  twoFactorManageLimiter,
  contactLimiter,
} from "../middlewares/rateLimit.js";

import QRCode from "qrcode";

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

      // Mot de passe correct mais second facteur en attente : ce
      // n'est pas encore une connexion. La tracer comme telle
      // fausserait le journal de sécurité, qui doit dire ce qui s'est
      // réellement passé.
      if (data.twoFactorRequired) {
        return sendSuccess(res, {
          message: "Saisissez le code de votre application.",
          data,
        });
      }

      await audit.recordLoginAttempt(req, {
        email,
        success: true,
        actorId: data.user.id,
      });

      sendSuccess(res, { message: "Connexion réussie.", data });
    })
  );

  // Seconde étape : vérification du code TOTP ou d'un code de secours.
  auth.post(
    "/login/2fa",
    twoFactorLimiter,
    asyncHandler(async (req, res) => {
      let data;

      try {
        data = await authService.verifyLoginTwoFactor(
          req.body ?? {}
        );
      } catch (error) {
        // Le compte visé n'est pas connu à ce stade — l'échec est
        // survenu avant. C'est l'adresse IP, enregistrée par `record`,
        // qui rend cette trace utile face à une attaque répétée.
        await audit.record(req, {
          action: "2fa_failed",
          actor: { email: "inconnu" },
        });

        throw error;
      }

      await audit.recordLoginAttempt(req, {
        email: data.user.email,
        success: true,
        actorId: data.user.id,
      });

      if (data.recoveryCodeUsed) {
        await audit.record(req, {
          action: "2fa_recovery_used",
          actor: data.user,
        });
      }

      sendSuccess(res, { message: "Connexion réussie.", data });
    })
  );

  // ---- Gestion du second facteur (compte connecté) ------------
  auth.get(
    "/2fa",
    requireAuth,
    asyncHandler(async (req, res) =>
      sendSuccess(res, {
        data: await authService.twoFactorStatus(req.user.id),
      })
    )
  );

  auth.post(
    "/2fa/setup",
    requireAuth,
    asyncHandler(async (req, res) => {
      const data = await authService.startTwoFactorSetup(
        req.user.id
      );

      // QR encodé en data: URI. La CSP du site autorise `img-src
      // 'self' data:` — l'image s'affiche sans requête réseau et sans
      // que le secret transite par un service tiers.
      const qrDataUrl = await QRCode.toDataURL(data.otpauthUrl, {
        width: 260,
        margin: 1,
        errorCorrectionLevel: "M",
      });

      sendSuccess(res, { data: { ...data, qrDataUrl } });
    })
  );

  auth.post(
    "/2fa/enable",
    requireAuth,
    twoFactorManageLimiter,
    asyncHandler(async (req, res) => {
      const data = await authService.enableTwoFactor(
        req.user.id,
        req.body ?? {}
      );

      await audit.record(req, { action: "2fa_enabled" });

      sendSuccess(res, {
        message:
          "Double authentification activée. Conservez vos codes de secours.",
        data,
      });
    })
  );

  auth.post(
    "/2fa/disable",
    requireAuth,
    twoFactorManageLimiter,
    asyncHandler(async (req, res) => {
      await authService.disableTwoFactor(
        req.user.id,
        req.body ?? {}
      );

      await audit.record(req, { action: "2fa_disabled" });

      sendSuccess(res, {
        message: "Double authentification désactivée.",
      });
    })
  );

  auth.post(
    "/2fa/recovery-codes",
    requireAuth,
    twoFactorManageLimiter,
    asyncHandler(async (req, res) => {
      const data = await authService.regenerateRecoveryCodes(
        req.user.id,
        req.body ?? {}
      );

      await audit.record(req, { action: "2fa_enabled" });

      sendSuccess(res, {
        message:
          "Nouveaux codes de secours générés. Les anciens ne fonctionnent plus.",
        data,
      });
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

  // ---- Lettre d'information ----------------------------------
  // Deuxième route publique en écriture, avec la même limitation de
  // débit que le formulaire de contact : sans elle, la liste se
  // remplirait d'adresses inventées en quelques minutes.
  api.post(
    "/newsletter",
    contactLimiter,
    asyncHandler(async (req, res) => {
      await newsletterService.subscribe({
        email: req.body?.email,
        name: req.body?.name,
        source: "footer",
        ip: req.ip,
      });

      // Réponse identique que l'adresse soit nouvelle ou déjà
      // inscrite : la différencier permettrait de tester si une
      // adresse donnée figure dans la liste.
      sendCreated(res, {
        message:
          "Votre adresse est enregistrée. Vous recevrez nos prochaines actualités.",
      });
    })
  );

  // Désinscription : publique par nécessité. Un lien qui exigerait
  // une connexion serait inutilisable, et l'envoi deviendrait fautif.
  api.post(
    "/newsletter/desinscription",
    asyncHandler(async (req, res) => {
      await newsletterService.unsubscribe(req.body?.token);

      sendSuccess(res, {
        message:
          "Vous êtes désinscrit. Vous ne recevrez plus nos actualités.",
      });
    })
  );

  const adminNewsletter = Router();

  adminNewsletter.use(requireAuth);

  adminNewsletter.get(
    "/",
    asyncHandler(async (req, res) => {
      const { items, meta } = await newsletterService.listAdmin(
        req.query
      );

      sendSuccess(res, { data: items, meta });
    })
  );

  adminNewsletter.get(
    "/export",
    asyncHandler(async (_req, res) => {
      const csv = await newsletterService.exportCsv();

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="abonnes-cava.csv"'
      );

      res.send(csv);
    })
  );

  adminNewsletter.delete(
    "/:id",
    requireRole("admin"),
    asyncHandler(async (req, res) => {
      await newsletterService.remove(req.params.id);

      await audit.record(req, {
        action: "delete",
        resource: "subscriber",
        resourceId: req.params.id,
      });

      sendNoContent(res);
    })
  );

  api.use("/admin/newsletter", adminNewsletter);

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

  // ---- Envoi de fichiers -------------------------------------
  // Délivre une signature à usage unique. Le fichier lui-même ne
  // transite jamais par cette API : le navigateur l'envoie
  // directement à Cloudinary. Voir upload.service.js.
  api.post(
    "/admin/uploads/signature",
    requireAuth,
    asyncHandler(async (req, res) =>
      sendSuccess(res, {
        data: uploadService.createSignature({
          folder: req.body?.folder,
        }),
      })
    )
  );

  // Permet à l'interface de savoir si l'envoi est disponible, et
  // d'afficher une explication utile plutôt qu'un bouton qui échoue.
  api.get(
    "/admin/uploads/status",
    requireAuth,
    asyncHandler(async (_req, res) =>
      sendSuccess(res, {
        data: { configured: uploadService.isConfigured() },
      })
    )
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
