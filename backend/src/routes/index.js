import { Router } from "express";

import Event from "../models/Event.js";
import Ministry from "../models/Ministry.js";
import Media from "../models/Media.js";
import Member from "../models/Member.js";
import Announcement from "../models/Announcement.js";
import Testimonial from "../models/Testimonial.js";
import Settings from "../models/Settings.js";
import Message from "../models/Message.js";
import Flock from "../models/Flock.js";
import Church from "../models/Church.js";

import { createCrudService } from "../services/crud.service.js";
import * as authService from "../services/auth.service.js";
import * as messageService from "../services/message.service.js";
import * as audit from "../services/audit.service.js";
import * as publishService from "../services/publish.service.js";
import * as uploadService from "../services/upload.service.js";
import * as newsletterService from "../services/newsletter.service.js";
import * as donationService from "../services/donation.service.js";
import * as receiptService from "../services/receipt.service.js";
import * as submissionService from "../services/submission.service.js";
import * as memberExportService from "../services/memberExport.service.js";
import * as memberCardService from "../services/memberCardSvg.service.js";
import * as presenceQrService from "../services/presenceQr.service.js";
import * as presenceService from "../services/presence.service.js";
import * as presenceExportService from "../services/presenceExport.service.js";
import {
  parseRegistrationNumber,
  releaseIfLastIssued,
} from "../services/registrationNumber.service.js";

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
import { requirePresenceSession } from "../middlewares/presenceAuth.js";
import {
  loginLimiter,
  twoFactorLimiter,
  twoFactorManageLimiter,
  contactLimiter,
  donationLimiter,
  submissionLimiter,
  lookupLimiter,
  publicUploadLimiter,
  presenceLoginLimiter,
  presenceScanLimiter,
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
  searchableFields: ["firstName", "lastName", "registrationNumber"],
});

// Supprimer un membre ne doit pas laisser un trou permanent dans la
// numérotation quand son matricule était le tout dernier émis pour
// son église — cas fréquent en test (inscription puis suppression
// immédiate). Enveloppe le `remove` générique plutôt que de dupliquer
// la route DELETE (rôle admin, journal d'audit, réponse 204 déjà
// gérés par resourceRouter) juste pour ce petit ajout.
const removeMember = members.remove;

members.remove = async (id) => {
  const existing = await Member.findById(id)
    .select("registrationNumber church")
    .lean();

  const result = await removeMember(id);

  if (existing?.registrationNumber && existing.church) {
    const parsed = parseRegistrationNumber(existing.registrationNumber);

    if (parsed) {
      await releaseIfLastIssued({
        church: existing.church,
        number: parsed.number,
      });
    }
  }

  return result;
};

const flocks = createCrudService(Flock, {
  label: "Bergerie",
  defaultSort: { church: 1, name: 1 },
  publicSort: { church: 1, name: 1 },
  searchableFields: ["name", "code"],
});

const churches = createCrudService(Church, {
  label: "Église",
  defaultSort: { number: 1 },
  publicSort: { number: 1 },
  searchableFields: ["name"],
});

const announcements = createCrudService(Announcement, {
  label: "Annonce",
  defaultSort: { createdAt: -1 },
  searchableFields: ["title", "body"],
});

const testimonials = createCrudService(Testimonial, {
  label: "Témoignage",
  defaultSort: { placement: 1, order: 1, createdAt: -1 },
  publicSort: { order: 1, createdAt: -1 },
  searchableFields: ["name", "quote", "role"],
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
  mount("flocks", flocks, {
    publicBySlug: false,
    publicFilters: ["church"],
    auditResource: "flock",
  });
  mount("churches", churches, {
    publicBySlug: false,
    auditResource: "church",
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

  // `publicFilters: ["placement"]` autorise /api/testimonials?placement=don :
  // chaque page ne récupère que les siens.
  mount("testimonials", testimonials, {
    publicBySlug: false,
    publicFilters: ["placement"],
    auditResource: "testimonial",
  });

  // ---- Inscriptions et mises à jour de fiche membre -------------
  //
  // Seule écriture publique de cette fonctionnalité. N'écrit JAMAIS
  // dans `Member` : uniquement dans `MemberSubmission`, en attente de
  // revue par un administrateur (voir submission.service.js).
  api.post(
    "/submissions",
    submissionLimiter,
    asyncHandler(async (req, res) => {
      const result = await submissionService.submit({
        type: req.body?.type,
        registrationNumber: req.body?.registrationNumber,
        data: req.body?.data,
      });

      sendCreated(res, {
        message: "Votre demande a été transmise à l'équipe.",
        data: result,
      });
    })
  );

  // Pré-remplissage pour un membre déjà informatisé : matricule + nom
  // de famille exact requis (voir submission.service.js#lookup). La
  // réponse est neutre dans tous les cas d'échec, pour ne pas servir
  // de vérificateur d'existence de matricule.
  api.post(
    "/submissions/lookup",
    lookupLimiter,
    asyncHandler(async (req, res) => {
      const result = await submissionService.lookup({
        registrationNumber: req.body?.registrationNumber,
        lastName: req.body?.lastName,
      });

      sendSuccess(res, { data: result.data });
    })
  );

  // Signature d'envoi de photo pour le formulaire public d'inscription
  // — seule route de signature Cloudinary sans authentification (voir
  // le commentaire sur `publicUploadLimiter`). Le dossier est imposé
  // ici, sans jamais lire `req.body.folder` : un visiteur ne peut pas
  // se servir de cette route pour écrire dans un autre dossier
  // (medias, ministries...) réservé à l'administration.
  api.post(
    "/uploads/signature",
    publicUploadLimiter,
    asyncHandler(async (_req, res) =>
      sendSuccess(res, {
        data: uploadService.createSignature({ folder: "members" }),
      })
    )
  );

  // ---- Badgeage des présences ------------------------------------
  //
  // Trois routes PUBLIQUES (aucun jeton d'admin), car c'est ici que se
  // joue l'authentification elle-même d'un agent : vérification du QR
  // de sécurité, puis connexion par matricule. Voir
  // docs/superpowers/specs/2026-08-04-badgeage-presences-design.md et
  // presenceAuth.js pour le détail de ce que chaque jeton prouve.
  const presencesPublic = Router();

  presencesPublic.post(
    "/qr/verify",
    presenceLoginLimiter,
    asyncHandler(async (req, res) => {
      const result = await presenceQrService.verifyToken(req.body?.token);

      if (!result.ok) {
        return res.status(401).json({
          success: false,
          message: presenceQrService.REASON_MESSAGES[result.reason],
          error: { status: 401, reason: result.reason },
        });
      }

      sendSuccess(res, {
        data: {
          label: result.qr.label,
          validFrom: result.qr.validFrom,
          validUntil: result.qr.validUntil,
        },
      });
    })
  );

  presencesPublic.post(
    "/agent-login",
    presenceLoginLimiter,
    asyncHandler(async (req, res) => {
      const result = await presenceService.agentLogin(
        { token: req.body?.token, matricule: req.body?.matricule },
        req
      );

      sendSuccess(res, { data: result });
    })
  );

  presencesPublic.post(
    "/scan",
    presenceScanLimiter,
    requirePresenceSession,
    asyncHandler(async (req, res) => {
      const result = await presenceService.scan(
        { registrationNumber: req.body?.registrationNumber },
        req.presenceAgent,
        req.presenceQr,
        req
      );

      sendSuccess(res, { data: result });
    })
  );

  presencesPublic.get(
    "/search",
    presenceScanLimiter,
    requirePresenceSession,
    asyncHandler(async (req, res) => {
      const results = await presenceService.search(req.query.q);

      sendSuccess(res, { data: results });
    })
  );

  presencesPublic.get(
    "/stats",
    requirePresenceSession,
    asyncHandler(async (req, res) => {
      const counts = await presenceService.countAttendance(req.presenceQr._id);

      sendSuccess(res, {
        data: {
          ...counts,
          qr: { label: req.presenceQr.label, validUntil: req.presenceQr.validUntil },
        },
      });
    })
  );

  presencesPublic.post(
    "/mark",
    presenceScanLimiter,
    requirePresenceSession,
    asyncHandler(async (req, res) => {
      const result = await presenceService.mark(
        { memberId: req.body?.memberId },
        req.presenceAgent,
        req.presenceQr,
        req
      );

      sendSuccess(res, { data: result });
    })
  );

  presencesPublic.post(
    "/mark-visitor",
    presenceScanLimiter,
    requirePresenceSession,
    asyncHandler(async (req, res) => {
      const result = await presenceService.markVisitor(
        {
          firstName: req.body?.firstName,
          lastName: req.body?.lastName,
          phone: req.body?.phone,
        },
        req.presenceAgent,
        req.presenceQr,
        req
      );

      sendCreated(res, { data: result });
    })
  );

  api.use("/presences", presencesPublic);

  // Administration des QR de sécurité — génération, révocation,
  // historique d'usage, présences enregistrées.
  const adminPresences = Router();

  adminPresences.use(requireAuth, requireRole("admin"));

  adminPresences.get(
    "/qrcodes",
    asyncHandler(async (_req, res) => {
      const data = await presenceQrService.listAdmin();

      sendSuccess(res, { data });
    })
  );

  adminPresences.post(
    "/qrcodes",
    asyncHandler(async (req, res) => {
      const data = await presenceQrService.generate(
        {
          label: req.body?.label,
          event: req.body?.event,
          validFrom: req.body?.validFrom,
          validUntil: req.body?.validUntil,
        },
        req.user
      );

      await audit.record(req, {
        action: "create",
        resource: "presenceSecurityQr",
        resourceId: data.id,
      });

      sendCreated(res, { data });
    })
  );

  adminPresences.get(
    "/qrcodes/:id/image",
    asyncHandler(async (req, res) => {
      const dataUrl = await presenceQrService.getImage(req.params.id);

      sendSuccess(res, { data: { dataUrl } });
    })
  );

  adminPresences.post(
    "/qrcodes/:id/revoke",
    asyncHandler(async (req, res) => {
      const data = await presenceQrService.revoke(req.params.id, req.user);

      await audit.record(req, {
        action: "update",
        resource: "presenceSecurityQr",
        resourceId: req.params.id,
      });

      sendSuccess(res, { data });
    })
  );

  adminPresences.get(
    "/qrcodes/:id/history",
    asyncHandler(async (req, res) => {
      const data = await presenceQrService.history(req.params.id);

      sendSuccess(res, { data });
    })
  );

  adminPresences.get(
    "/attendance",
    asyncHandler(async (req, res) => {
      const data = await presenceService.listAttendance({
        securityQr: req.query.securityQr,
        limit: req.query.limit,
      });

      sendSuccess(res, { data });
    })
  );

  adminPresences.get(
    "/qrcodes/:id/attendance-counts",
    asyncHandler(async (req, res) => {
      const data = await presenceService.countAttendance(req.params.id);

      sendSuccess(res, { data });
    })
  );

  adminPresences.get(
    "/qrcodes/:id/export.xlsx",
    asyncHandler(async (req, res) => {
      const buffer = await presenceExportService.buildAttendanceXlsx(
        req.params.id
      );

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="presences-${req.params.id}.xlsx"`
      );

      res.send(buffer);
    })
  );

  adminPresences.get(
    "/qrcodes/:id/export.pdf",
    asyncHandler(async (req, res) => {
      const buffer = await presenceExportService.buildAttendancePdf(
        req.params.id
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="presences-${req.params.id}.pdf"`
      );

      res.send(buffer);
    })
  );

  api.use("/admin/presences", adminPresences);

  const adminSubmissions = Router();

  // Une soumission en attente porte les mêmes données personnelles
  // qu'une fiche membre (nom, téléphone, e-mail, date de naissance,
  // adresse...) — même exigence que `members` (`writeRoles: ["admin"]`) :
  // réservé à un administrateur, y compris en LECTURE, pas seulement
  // à l'écriture.
  adminSubmissions.use(requireAuth);
  adminSubmissions.use(requireRole("admin"));

  adminSubmissions.get(
    "/",
    asyncHandler(async (req, res) => {
      const { items, meta } = await submissionService.listPending({
        page: req.query.page,
        limit: req.query.limit,
      });

      sendSuccess(res, { data: items, meta });
    })
  );

  adminSubmissions.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const data = await submissionService.getById(req.params.id);

      sendSuccess(res, { data });
    })
  );

  adminSubmissions.post(
    "/:id/approve",
    requireRole("admin"),
    asyncHandler(async (req, res) => {
      const data = await submissionService.approve(req.params.id, {
        overrides: req.body?.overrides,
        user: req.user,
      });

      await audit.record(req, {
        action: "create",
        resource: "member",
        resourceId: data.member?._id,
      });

      sendSuccess(res, {
        message: "Inscription validée. Le matricule a été attribué.",
        data,
      });
    })
  );

  adminSubmissions.post(
    "/:id/reject",
    requireRole("admin"),
    asyncHandler(async (req, res) => {
      const data = await submissionService.reject(req.params.id, {
        reason: req.body?.reason,
        user: req.user,
      });

      await audit.record(req, {
        action: "update",
        resource: "submission",
        resourceId: req.params.id,
      });

      sendSuccess(res, {
        message: "Demande rejetée.",
        data,
      });
    })
  );

  api.use("/admin/submissions", adminSubmissions);

  // ---- Export des membres (Excel / PDF) --------------------------
  //
  // Déclaré AVANT le montage de la ressource `members`, dont la route
  // GET /admin/members/:id intercepterait sinon "export.xlsx" comme un
  // identifiant — même piège que /donations/:reference/recu plus haut.
  const memberExportRouter = Router();

  memberExportRouter.use(requireAuth, requireRole("admin"));

  memberExportRouter.get(
    "/export.xlsx",
    asyncHandler(async (req, res) => {
      // Pas de paramètre `status` : les membres désactivés sont
      // toujours exclus du registre exporté (voir
      // memberExport.service.js#fetchMembers).
      const buffer = await memberExportService.buildMembersXlsx({
        church: req.query.church,
        flock: req.query.flock,
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="membres-cava.xlsx"'
      );

      res.send(buffer);
    })
  );

  memberExportRouter.get(
    "/export.pdf",
    asyncHandler(async (req, res) => {
      const buffer = await memberExportService.buildMembersPdf({
        church: req.query.church,
        flock: req.query.flock,
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="registre-membres-cava.pdf"'
      );

      res.send(buffer);
    })
  );

  // Carte de membre individuelle. Chemin à trois segments
  // (/:id/card.pdf) : ne peut pas être confondu avec la route
  // générique GET /admin/members/:id de la ressource CRUD montée plus
  // bas, même sans l'égard d'ordre qui protège /export.xlsx et
  // /export.pdf ci-dessus.
  memberExportRouter.get(
    "/:id/card.pdf",
    asyncHandler(async (req, res) => {
      const buffer = await memberCardService.buildMemberCardPdf(
        req.params.id
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="carte-membre-${req.params.id}.pdf"`
      );

      res.send(buffer);
    })
  );

  memberExportRouter.get(
    "/:id/card.jpg",
    asyncHandler(async (req, res) => {
      const buffer = await memberCardService.buildMemberCardJpeg(
        req.params.id
      );

      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="carte-membre-${req.params.id}.jpg"`
      );

      res.send(buffer);
    })
  );

  // Verso : identique pour tous les membres (aucune donnée injectée),
  // mais servi via la même vérification d'existence/statut que le
  // recto — pas de fuite d'un verso pour un membre introuvable ou
  // désactivé.
  memberExportRouter.get(
    "/:id/card-verso.jpg",
    asyncHandler(async (req, res) => {
      const buffer = await memberCardService.buildMemberCardVersoJpeg(
        req.params.id
      );

      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="carte-membre-${req.params.id}-verso.jpg"`
      );

      res.send(buffer);
    })
  );

  api.use("/admin/members", memberExportRouter);

  // Les membres portent des données personnelles : leur écriture est
  // réservée aux administrateurs, un éditeur n'y touche pas.
  mount("members", members, {
    publicBySlug: false,
    auditResource: "member",
    writeRoles: ["admin"],
    adminFilters: ["church", "flock"],
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

  // ---- Dons -----------------------------------------------------
  //
  // Trois routes publiques, aux natures très différentes :
  //
  //   POST /donations          le visiteur déclare son intention
  //   POST /donations/webhook  le prestataire notifie le résultat
  //   GET  /donations/:ref     la page de retour interroge l'état
  //
  // Aucune ne permet de marquer un don payé : c'est toujours un appel
  // SORTANT vers le prestataire qui tranche (voir donation.service.js).

  // Chiffres publics de la collecte.
  //
  // Agrégats uniquement : jamais un donateur, jamais un montant
  // individuel. La page Don affichait jusqu'ici des chiffres inventés
  // (« 18,5 M collectés », « 1 284 contributeurs ») qui se
  // contredisaient d'une section à l'autre. Mieux vaut le vrai total,
  // même modeste, ou rien.
  api.get(
    "/donations/stats",
    asyncHandler(async (_req, res) =>
      sendSuccess(res, { data: await donationService.publicStats() })
    )
  );

  api.get(
    "/donations/config",
    asyncHandler(async (_req, res) =>
      sendSuccess(res, {
        data: { enabled: donationService.paymentEnabled() },
      })
    )
  );

  api.post(
    "/donations",
    donationLimiter,
    asyncHandler(async (req, res) => {
      const data = await donationService.createDonation(req.body ?? {}, {
        ip: req.ip,
      });

      sendCreated(res, {
        message: "Redirection vers le paiement.",
        data,
      });
    })
  );

  api.post(
    "/donations/webhook",
    asyncHandler(async (req, res) => {
      await donationService.handleNotification(
        req.body ?? {},
        req.get("x-token")
      );

      // Le prestataire attend un 200 pour cesser de rejouer sa
      // notification. Le corps n'est pas lu par lui.
      sendSuccess(res, { message: "Notification traitée." });
    })
  );

  // Reçu au format PDF.
  //
  // Déclarée AVANT `/donations/:reference` : Express retient la
  // première route qui correspond, et `:reference` n'avalerait pas
  // « /recu » ici, mais l'ordre reste la garantie la plus lisible.
  //
  // Pas d'authentification : la référence tient lieu de clé. Elle fait
  // 64 bits d'aléa, elle n'est pas devinable, et c'est le seul moyen
  // qu'un donateur non identifié récupère son propre reçu.
  api.get(
    "/donations/:reference/recu",
    asyncHandler(async (req, res) => {
      const donation = await donationService.receiptFor(
        String(req.params.reference).slice(0, 40)
      );

      const pdf = await receiptService.buildReceipt(donation);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Length", pdf.length);

      // `inline` : le navigateur affiche le reçu au lieu de le
      // télécharger à l'aveugle. Le bouton de téléchargement du site
      // force l'enregistrement de son côté.
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${receiptService.receiptFilename(donation)}"`
      );

      // Un reçu ne change jamais : inutile de le régénérer à chaque
      // consultation. Privé, car il porte le nom du donateur et ne
      // doit pas être mis en cache par un intermédiaire partagé.
      res.setHeader("Cache-Control", "private, max-age=3600");

      res.end(pdf);
    })
  );

  api.get(
    "/donations/:reference",
    asyncHandler(async (req, res) => {
      const data = await donationService.publicStatus(
        String(req.params.reference).slice(0, 40)
      );

      sendSuccess(res, { data });
    })
  );

  // ---- Dons : administration ------------------------------------
  const adminDonations = Router();

  adminDonations.use(requireAuth);

  adminDonations.get(
    "/",
    asyncHandler(async (req, res) => {
      const data = await donationService.adminList({
        status: req.query.status,
        limit: req.query.limit,
        page: req.query.page,
      });

      sendSuccess(res, { data: data.items, meta: {
        total: data.total,
        page: data.page,
        perPage: data.perPage,
      } });
    })
  );

  adminDonations.get(
    "/summary",
    asyncHandler(async (_req, res) => {
      const [summary, stale] = await Promise.all([
        donationService.adminSummary(),
        donationService.staleCount(),
      ]);

      sendSuccess(res, {
        data: {
          ...summary,
          stale,
          enabled: donationService.paymentEnabled(),
        },
      });
    })
  );

  // QR code à projeter pendant un direct.
  //
  // Généré côté serveur plutôt que dans le navigateur : le lien encodé
  // est ainsi toujours construit à partir de PUBLIC_SITE_URL, sans
  // qu'un copier-coller approximatif puisse produire un QR code menant
  // à une adresse morte — affiché sur un écran de culte, l'erreur ne se
  // verrait qu'une fois trop tard.
  adminDonations.get(
    "/qrcode",
    asyncHandler(async (req, res) => {
      const params = new URLSearchParams();

      const type = String(req.query.type ?? "").trim();
      const amount = Number(req.query.amount);

      if (type) params.set("type", type.slice(0, 20));
      if (Number.isInteger(amount) && amount > 0) {
        params.set("amount", String(amount));
      }

      const query = params.toString();

      const url =
        `${donationService.publicSiteUrl()}/donate` +
        (query ? `?${query}` : "");

      const dataUrl = await QRCode.toDataURL(url, {
        width: 900,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#0d5b3e", light: "#ffffff" },
      });

      // Seconde barrière, en plus de la validation au démarrage.
      //
      // Un QR code menant à une adresse locale est parfaitement lisible
      // et parfaitement inutile : le téléphone d'un fidèle n'atteindra
      // jamais le `localhost` du serveur. Comme il est destiné à être
      // projeté devant une assemblée, l'erreur doit se voir AVANT, pas
      // pendant.
      const unreachable = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(
        url
      );

      sendSuccess(res, {
        data: {
          url,
          dataUrl,
          warning: unreachable
            ? "Ce QR code pointe vers une adresse locale, injoignable depuis un téléphone. " +
              "Renseignez PUBLIC_SITE_URL sur le serveur avant de le projeter."
            : null,
        },
      });
    })
  );

  api.use("/admin/donations", adminDonations);

  // ---- Statistiques publiques de la communauté ----------------
  //
  // Renvoie UNIQUEMENT des compteurs. Les fiches de membres restent
  // inaccessibles publiquement (voir `publicFilter: { _id: null }` sur
  // le service `members`) : ce sont des données personnelles.
  //
  // Un nombre agrégé ne permet d'identifier personne, alors qu'il donne
  // au visiteur une idée juste de la vie de l'église — bien plus qu'un
  // chiffre inventé et jamais mis à jour.
  api.get(
    "/community/stats",
    asyncHandler(async (_req, res) => {
      const [members, servants, areas, ministries] =
        await Promise.all([
          Member.countDocuments({ status: "actif" }),

          // Serviteurs et responsables : ceux qui portent une charge
          // dans l'église, par opposition aux membres simples.
          Member.countDocuments({
            status: "actif",
            role: { $in: ["serviteur", "responsable"] },
          }),

          // Quartiers distincts réellement renseignés.
          //
          // Volontairement « quartiers représentés » et non « groupes
          // de maison » : la page Communauté affiche par ailleurs une
          // liste éditoriale de groupes, et deux nombres différents
          // censés désigner la même chose se contrediraient à l'écran.
          Member.distinct("area", {
            status: "actif",
            area: { $nin: [null, ""] },
          }),

          Ministry.countDocuments({ status: "published" }),
        ]);

      sendSuccess(res, {
        data: {
          members,
          servants,
          districts: areas.length,
          ministries,
        },
      });
    })
  );

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
