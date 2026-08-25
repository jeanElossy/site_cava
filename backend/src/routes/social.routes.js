import { Router } from "express";

import * as socialContributionService from "../services/socialContribution.service.js";
import * as socialReceiptService from "../services/socialReceipt.service.js";
import * as socialAidService from "../services/socialAid.service.js";
import * as socialFundYearService from "../services/socialFundYear.service.js";
import * as audit from "../services/audit.service.js";

import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess, sendCreated, sendNoContent } from "../utils/respond.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";

// Routes du module Service Social (cotisations, dashboard, caisse en
// lecture — Phase 1 ; aides sociales/décaissements — Phase 2).
// Routeur sur-mesure, comme le module Dons : la logique (montants
// figés, génération de référence, calcul de solde) est trop
// spécifique pour le CRUD générique `resourceRouter`.

const SOCIAL_READ_ROLES = [
  "admin",
  "social_admin",
  "social_agent",
  "social_approver",
  "social_viewer",
];

const SOCIAL_WRITE_ROLES = ["admin", "social_admin", "social_agent"];

const SOCIAL_ADMIN_ROLES = ["admin", "social_admin"];

// Décision sur une aide (validation = décaissement, refus) : réservé à
// l'administrateur du module et à l'approbateur — PAS l'agent qui se
// contente de créer des demandes (`social_agent`, dans
// SOCIAL_WRITE_ROLES mais pas ici). L'annulation d'une aide payée est
// plus restrictive encore : réservée à SOCIAL_ADMIN_ROLES, voir plus
// bas.
const SOCIAL_DECISION_ROLES = ["admin", "social_admin", "social_approver"];

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

// Année d'EXERCICE : bornée plus bas que `parseYear`, qui sert aux
// cotisations. Aucune caisse n'existe avant 2024 (voir
// socialFundYear.service.js#SOCIAL_START_YEAR).
const parseExerciceYear = (value) => {
  const n = parseYear(value);

  return n !== undefined && n >= socialFundYearService.SOCIAL_START_YEAR
    ? n
    : undefined;
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
        meta: {
          total: data.total,
          page: data.page,
          perPage: data.perPage,
          // Totaux de la PÉRIODE entière (filtre de statut et
          // pagination exclus) : la barre de totaux de l'écran doit
          // décrire le mois, pas la page affichée.
          totals: data.totals,
        },
      });
    })
  );

  router.get(
    "/contributions/impayes",
    requireRole(...SOCIAL_READ_ROLES),
    asyncHandler(async (req, res) => {
      const data = await socialContributionService.listUnpaid({
        church: parseChurch(req.query.church),
        year: parseExerciceYear(req.query.year),
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
        year: parseExerciceYear(req.query.year),
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
        year: parseExerciceYear(req.query.year),
        page: parsePositiveInt(req.query.page),
        limit: parsePositiveInt(req.query.limit),
      });

      sendSuccess(res, {
        data: data.items,
        meta: { total: data.total, page: data.page, perPage: data.perPage },
      });
    })
  );

  // ---- Exercices annuels de la caisse ---------------------------
  //
  // Une caisse par église ET par année : les mouvements, le solde et
  // la clôture appartiennent à un exercice, plus à l'église entière
  // depuis toujours (voir socialFundYear.service.js).

  router.get(
    "/exercices",
    requireRole(...SOCIAL_READ_ROLES),
    asyncHandler(async (req, res) => {
      const data = await socialFundYearService.listFundYears({
        church: parseChurch(req.query.church),
      });

      sendSuccess(res, { data });
    })
  );

  router.post(
    "/exercices",
    requireRole(...SOCIAL_ADMIN_ROLES),
    asyncHandler(async (req, res) => {
      const data = await socialFundYearService.openFundYear(
        req.body?.church,
        {
          year: req.body?.year,
          openingBalance: req.body?.openingBalance,
        },
        req.user
      );

      await audit.record(req, {
        action: "create",
        resource: "socialFundYear",
        resourceId: `${data.church}-${data.year}`,
      });

      sendCreated(res, {
        message: `Exercice ${data.year} ouvert.`,
        data,
      });
    })
  );

  router.patch(
    "/exercices/:church/:year/cloturer",
    requireRole(...SOCIAL_ADMIN_ROLES),
    asyncHandler(async (req, res) => {
      const data = await socialFundYearService.closeFundYear(
        req.params.church,
        req.params.year,
        req.user
      );

      await audit.record(req, {
        action: "update",
        resource: "socialFundYear",
        resourceId: `${req.params.church}-${req.params.year}`,
      });

      sendSuccess(res, {
        message: `Exercice ${data.closed.year} clôturé. Le solde est reporté sur ${
          data.next ? data.next.year : "l'exercice suivant"
        }.`,
        data,
      });
    })
  );

  // Rouvrir est plus sensible que clôturer : ça rend de nouveau
  // modifiable une caisse déjà arrêtée. Réservé aux mêmes rôles que la
  // clôture, et journalisé.
  router.patch(
    "/exercices/:church/:year/rouvrir",
    requireRole(...SOCIAL_ADMIN_ROLES),
    asyncHandler(async (req, res) => {
      const data = await socialFundYearService.reopenFundYear(
        req.params.church,
        req.params.year,
        req.user
      );

      await audit.record(req, {
        action: "update",
        resource: "socialFundYear",
        resourceId: `${req.params.church}-${req.params.year}`,
      });

      sendSuccess(res, { message: `Exercice ${data.year} rouvert.`, data });
    })
  );

  // Rattrapage manuel des lignes dues, sans attendre le job quotidien.
  // Idempotent : ne crée que ce qui manque, ne réécrit jamais une ligne
  // existante (index unique {member, year, month}).
  router.post(
    "/contributions/generer",
    requireRole(...SOCIAL_ADMIN_ROLES),
    asyncHandler(async (req, res) => {
      const church = parseChurch(req.body?.church);

      const created = await socialContributionService.generateDueContributions(
        church ? { church } : {}
      );

      await audit.record(req, {
        action: "update",
        resource: "socialContribution",
        resourceId: church ? String(church) : "toutes",
      });

      sendSuccess(res, {
        message:
          created > 0
            ? `${created} ligne(s) d'offrande générée(s).`
            : "Aucune ligne manquante : tout est déjà à jour.",
        data: { created },
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

  // ---- Types d'aide (Phase 2) -----------------------------------
  //
  // CRUD écrit à la main, PAS via `resourceRouter` générique : celui-ci
  // réserve la suppression au rôle littéral "admin", ce qui exclurait
  // "social_admin" — incohérent avec le reste du module.

  router.get(
    "/aid-types",
    requireRole(...SOCIAL_READ_ROLES),
    asyncHandler(async (_req, res) => {
      const data = await socialAidService.getAidTypes();

      sendSuccess(res, { data });
    })
  );

  router.post(
    "/aid-types",
    requireRole(...SOCIAL_ADMIN_ROLES),
    asyncHandler(async (req, res) => {
      const data = await socialAidService.createAidType(
        {
          name: req.body?.name,
          description: req.body?.description,
          active: req.body?.active,
          order: req.body?.order,
        },
        req.user
      );

      await audit.record(req, {
        action: "create",
        resource: "socialAidType",
        resourceId: data._id,
      });

      sendCreated(res, { message: "Type d'aide créé.", data });
    })
  );

  router.patch(
    "/aid-types/:id",
    requireRole(...SOCIAL_ADMIN_ROLES),
    asyncHandler(async (req, res) => {
      const data = await socialAidService.updateAidType(req.params.id, {
        name: req.body?.name,
        description: req.body?.description,
        active: req.body?.active,
        order: req.body?.order,
      });

      await audit.record(req, {
        action: "update",
        resource: "socialAidType",
        resourceId: req.params.id,
      });

      sendSuccess(res, { message: "Type d'aide mis à jour.", data });
    })
  );

  router.delete(
    "/aid-types/:id",
    requireRole(...SOCIAL_ADMIN_ROLES),
    asyncHandler(async (req, res) => {
      await socialAidService.removeAidType(req.params.id);

      await audit.record(req, {
        action: "delete",
        resource: "socialAidType",
        resourceId: req.params.id,
      });

      sendNoContent(res);
    })
  );

  // ---- Aides sociales (Phase 2) -----------------------------------

  router.get(
    "/aids",
    requireRole(...SOCIAL_READ_ROLES),
    asyncHandler(async (req, res) => {
      const data = await socialAidService.listAids({
        church: parseChurch(req.query.church),
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
    "/aids/:id",
    requireRole(...SOCIAL_READ_ROLES),
    asyncHandler(async (req, res) => {
      const data = await socialAidService.getAidById(req.params.id);

      sendSuccess(res, { data });
    })
  );

  router.post(
    "/aids",
    requireRole(...SOCIAL_WRITE_ROLES),
    asyncHandler(async (req, res) => {
      const data = await socialAidService.createAid(
        {
          memberId: req.body?.memberId,
          aidTypeId: req.body?.aidTypeId,
          amount: req.body?.amount,
          motif: req.body?.motif,
          description: req.body?.description,
          proofUrl: req.body?.proofUrl,
        },
        req.user
      );

      await audit.record(req, {
        action: "create",
        resource: "socialAid",
        resourceId: data._id,
      });

      sendCreated(res, { message: "Demande d'aide enregistrée.", data });
    })
  );

  router.patch(
    "/aids/:id/valider",
    requireRole(...SOCIAL_DECISION_ROLES),
    asyncHandler(async (req, res) => {
      const data = await socialAidService.validateAid(req.params.id, req.user);

      await audit.record(req, {
        action: "update",
        resource: "socialAid",
        resourceId: req.params.id,
      });

      // Décision assumée de ne pas bloquer un compte qui valide sa
      // propre demande (voir la spec Phase 2) — mais l'audit note
      // explicitement ce cas dans un second événement dédié, pour
      // rester repérable si l'équipe grandit.
      if (data.selfApproved) {
        await audit.record(req, {
          action: "update",
          resource: "socialAid_selfApproved",
          resourceId: req.params.id,
        });
      }

      sendSuccess(res, { message: "Aide validée et décaissée.", data });
    })
  );

  router.patch(
    "/aids/:id/refuser",
    requireRole(...SOCIAL_DECISION_ROLES),
    asyncHandler(async (req, res) => {
      const data = await socialAidService.refuseAid(
        req.params.id,
        { motif: req.body?.motif },
        req.user
      );

      await audit.record(req, {
        action: "update",
        resource: "socialAid",
        resourceId: req.params.id,
      });

      sendSuccess(res, { message: "Aide refusée.", data });
    })
  );

  router.patch(
    "/aids/:id/annuler",
    requireRole(...SOCIAL_ADMIN_ROLES),
    asyncHandler(async (req, res) => {
      const data = await socialAidService.cancelAid(
        req.params.id,
        { motif: req.body?.motif },
        req.user
      );

      await audit.record(req, {
        action: "update",
        resource: "socialAid",
        resourceId: req.params.id,
      });

      sendSuccess(res, { message: "Aide annulée.", data });
    })
  );

  return router;
};
