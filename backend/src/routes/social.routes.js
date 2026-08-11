import { Router } from "express";

import * as socialContributionService from "../services/socialContribution.service.js";
import * as socialReceiptService from "../services/socialReceipt.service.js";
import * as audit from "../services/audit.service.js";

import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess, sendCreated } from "../utils/respond.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";

// Routes du module Service Social (cotisations, dashboard, caisse en
// lecture — Phase 1). Routeur sur-mesure, comme le module Dons : la
// logique (montants figés, génération de référence, calcul de solde)
// est trop spécifique pour le CRUD générique `resourceRouter`.

const SOCIAL_READ_ROLES = [
  "admin",
  "social_admin",
  "social_agent",
  "social_approver",
  "social_viewer",
];

const SOCIAL_WRITE_ROLES = ["admin", "social_admin", "social_agent"];

const SOCIAL_ADMIN_ROLES = ["admin", "social_admin"];

// Un `church`/`page`/`limit` hors plage ou non numérique doit être
// traité comme absent (pas de filtre), pas planter — voir le cahier
// des charges Phase 1.
const parseChurch = (value) => {
  const n = Number(value);

  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : undefined;
};

const parseYear = (value) => {
  const n = Number(value);

  return Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : undefined;
};

const parseMonth = (value) => {
  const n = Number(value);

  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : undefined;
};

const parsePositiveInt = (value) => {
  const n = Number(value);

  return Number.isInteger(n) && n > 0 ? n : undefined;
};

export const buildSocialRouter = () => {
  const router = Router();

  router.use(requireAuth);

  router.get(
    "/settings",
    requireRole(...SOCIAL_READ_ROLES),
    asyncHandler(async (_req, res) => {
      const data = await socialContributionService.getSettings();

      sendSuccess(res, { data });
    })
  );

  router.patch(
    "/settings/:church",
    requireRole(...SOCIAL_ADMIN_ROLES),
    asyncHandler(async (req, res) => {
      const data = await socialContributionService.upsertSettings(
        req.params.church,
        {
          monthlyContributionAmount: req.body?.monthlyContributionAmount,
          openingBalance: req.body?.openingBalance,
        },
        req.user
      );

      await audit.record(req, {
        action: "update",
        resource: "socialFundSettings",
        resourceId: req.params.church,
      });

      sendSuccess(res, {
        message: "Réglages du Service Social mis à jour.",
        data,
      });
    })
  );

  router.get(
    "/members/search",
    requireRole(...SOCIAL_READ_ROLES),
    asyncHandler(async (req, res) => {
      const data = await socialContributionService.searchMembers({
        q: req.query.q,
        church: parseChurch(req.query.church),
      });

      sendSuccess(res, { data });
    })
  );

  router.get(
    "/members/:memberId/fiche",
    requireRole(...SOCIAL_READ_ROLES),
    asyncHandler(async (req, res) => {
      const data = await socialContributionService.getMemberSocialFile(
        req.params.memberId
      );

      sendSuccess(res, { data });
    })
  );

  router.post(
    "/contributions",
    requireRole(...SOCIAL_WRITE_ROLES),
    asyncHandler(async (req, res) => {
      const data = await socialContributionService.recordPayments(
        {
          memberId: req.body?.memberId,
          payments: req.body?.payments,
        },
        req.user
      );

      // Un audit par ligne réellement enregistrée — dans la route, pas
      // dans le service, qui ne connaît pas `req`.
      for (const result of data.results) {
        if (!result.ok) continue;

        await audit.record(req, {
          action: "create",
          resource: "socialContribution",
          resourceId: result.id,
        });
      }

      sendCreated(res, {
        message: "Paiement(s) enregistré(s).",
        data,
      });
    })
  );

  router.get(
    "/contributions",
    requireRole(...SOCIAL_READ_ROLES),
    asyncHandler(async (req, res) => {
      const data = await socialContributionService.listContributions({
        church: parseChurch(req.query.church),
        year: parseYear(req.query.year),
        month: parseMonth(req.query.month),
        status: req.query.status,
        search: req.query.search,
        page: parsePositiveInt(req.query.page),
        limit: parsePositiveInt(req.query.limit),
      });

      sendSuccess(res, {
        data: data.items,
        meta: { total: data.total, page: data.page, perPage: data.perPage },
      });
    })
  );

  router.get(
    "/contributions/impayes",
    requireRole(...SOCIAL_READ_ROLES),
    asyncHandler(async (req, res) => {
      const data = await socialContributionService.listUnpaid({
        church: parseChurch(req.query.church),
      });

      sendSuccess(res, { data });
    })
  );

  router.patch(
    "/contributions/:id/exonerer",
    requireRole(...SOCIAL_ADMIN_ROLES),
    asyncHandler(async (req, res) => {
      const data = await socialContributionService.exempt(
        req.params.id,
        { motif: req.body?.motif },
        req.user
      );

      await audit.record(req, {
        action: "update",
        resource: "socialContribution",
        resourceId: req.params.id,
      });

      sendSuccess(res, { message: "Cotisation exonérée.", data });
    })
  );

  // Reçu PDF — authentifié, contrairement au reçu de don qui est
  // public par référence (celui-ci reste interne au dashboard, voir
  // socialReceipt.service.js).
  router.get(
    "/contributions/:id/recu",
    requireRole(...SOCIAL_READ_ROLES),
    asyncHandler(async (req, res) => {
      const contribution = await socialContributionService.getReceiptData(
        req.params.id
      );

      const pdf = await socialReceiptService.buildContributionReceipt(
        contribution
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Length", pdf.length);
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${socialReceiptService.contributionReceiptFilename(contribution)}"`
      );
      res.setHeader("Cache-Control", "private, max-age=3600");

      res.end(pdf);
    })
  );

  router.get(
    "/caisse",
    requireRole(...SOCIAL_READ_ROLES),
    asyncHandler(async (req, res) => {
      const data = await socialContributionService.caisse({
        church: parseChurch(req.query.church),
      });

      sendSuccess(res, { data });
    })
  );

  router.get(
    "/caisse/mouvements",
    requireRole(...SOCIAL_READ_ROLES),
    asyncHandler(async (req, res) => {
      const data = await socialContributionService.ledgerMovements({
        church: parseChurch(req.query.church),
        page: parsePositiveInt(req.query.page),
        limit: parsePositiveInt(req.query.limit),
      });

      sendSuccess(res, {
        data: data.items,
        meta: { total: data.total, page: data.page, perPage: data.perPage },
      });
    })
  );

  router.get(
    "/dashboard",
    requireRole(...SOCIAL_READ_ROLES),
    asyncHandler(async (req, res) => {
      const data = await socialContributionService.dashboard({
        church: parseChurch(req.query.church),
      });

      sendSuccess(res, { data });
    })
  );

  return router;
};
