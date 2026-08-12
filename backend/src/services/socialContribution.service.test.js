import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import Member from "../models/Member.js";
import User from "../models/User.js";
import SocialFundSettings from "../models/SocialFundSettings.js";
import SocialContribution from "../models/SocialContribution.js";
import SocialLedgerEntry from "../models/SocialLedgerEntry.js";
import * as socialContributionService from "./socialContribution.service.js";

// ------------------------------------------------------------------
// ÉCART ASSUMÉ PAR RAPPORT A LA CONSIGNE "church: 9"
// ------------------------------------------------------------------
// Le modèle Member (préexistant, non modifié ici) valide strictement
// church entre 1 et 5 (voir Member.js et le test qui vérifie
// explicitement que church: 9 est REJETÉ - Member.test.js, "rejette
// une église hors de la plage 1-5"). La consigne du projet d'utiliser
// une église fictive church: 9 pour isoler les tests est donc
// inapplicable dès qu'un Member est en jeu, ce que ce module fait à
// chaque test.
//
// A la place, l'église 5 est utilisée : elle appartient à la vraie
// plage 1-5 (donc valide pour tous les modèles, y compris Member), et
// n'a AUCUN membre actif réel à ce jour ni aucun SocialFundSettings
// existant (vérifié manuellement avant d'écrire ce test - seule
// l'église 1 est actuellement active en pratique, voir la spec
// Phase 1).
//
// generateDueContributionsForCurrentMonth() DOIT être appelée avec
// `{ church: TEST_CHURCH }` ci-dessous : sans ce filtre, elle balaie
// TOUTES les églises dotées d'un SocialFundSettings, y compris l'église
// 1 réelle — bug constaté concrètement (des offrandes réellement
// payées de l'église 1 écrasées par une régénération "non_paye"
// pendant une exécution de cette suite). Voir le commentaire du
// paramètre `church` sur la fonction elle-même.
const TEST_CHURCH = 5;
const AMOUNT = 1500;

let admin;

const cleanup = async () => {
  await SocialContribution.deleteMany({ church: TEST_CHURCH });
  await SocialLedgerEntry.deleteMany({ church: TEST_CHURCH });
  await Member.deleteMany({ church: TEST_CHURCH });
  await SocialFundSettings.deleteMany({ church: TEST_CHURCH });
};

const makeMember = (overrides = {}) =>
  Member.create({
    firstName: "Test",
    lastName: `Social ${Math.random().toString(36).slice(2, 8)}`,
    church: TEST_CHURCH,
    status: "actif",
    ...overrides,
  });

describe("socialContribution.service (intégration MongoDB)", () => {
  before(async () => {
    await connectTestDb();
    await cleanup();

    // PAS de `.lean()` : le service lit `user.id`, un virtuel Mongoose
    // (`_id.toString()`) absent d'un document "lean" — piège identique
    // à celui documenté dans donation.service.test.js.
    admin = await User.findOne({ role: "admin" });

    if (!admin) {
      admin = await User.create({
        name: "Admin Test Service Social",
        email: "admin.social.testsuite@example.invalid",
        password: "MotDePasseTemporaire123!",
        role: "admin",
      });
    }

    await SocialFundSettings.create({
      church: TEST_CHURCH,
      monthlyContributionAmount: AMOUNT,
      openingBalance: 0,
    });
  });

  after(async () => {
    await cleanup();
    await disconnectTestDb();
  });

  it("génère les lignes du mois courant de façon idempotente", async () => {
    const m1 = await makeMember();
    const m2 = await makeMember();

    await socialContributionService.generateDueContributionsForCurrentMonth({
      church: TEST_CHURCH,
    });

    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;

    const firstPass = await SocialContribution.find({
      church: TEST_CHURCH,
      year,
      month,
    }).lean();

    assert.equal(firstPass.length, 2);

    // Deuxième appel : aucune ligne supplémentaire, aucune erreur.
    await socialContributionService.generateDueContributionsForCurrentMonth({
      church: TEST_CHURCH,
    });

    const secondPass = await SocialContribution.find({
      church: TEST_CHURCH,
      year,
      month,
    }).lean();

    assert.equal(secondPass.length, 2);

    const ids = secondPass.map((c) => String(c.member)).sort();
    assert.deepEqual(ids, [String(m1._id), String(m2._id)].sort());
  });

  it("paiement d'un mois complet : statut payé, référence générée, mouvement de caisse", async () => {
    const member = await makeMember();

    const { results, totalPaid } = await socialContributionService.recordPayments(
      { memberId: member._id, payments: [{ year: 2025, month: 6, amount: AMOUNT }] },
      admin
    );

    assert.equal(results.length, 1);
    assert.equal(results[0].ok, true);
    assert.equal(results[0].status, "paye");
    assert.match(results[0].reference, /^SOC-\d{8}-\d{6}$/);
    assert.equal(totalPaid, AMOUNT);

    const stored = await SocialContribution.findOne({
      member: member._id,
      year: 2025,
      month: 6,
    }).lean();

    assert.equal(stored.status, "paye");
    assert.equal(stored.amountPaid, AMOUNT);
    assert.ok(stored.paidAt);
    assert.equal(String(stored.recordedBy), String(admin._id));

    const ledgerEntry = await SocialLedgerEntry.findOne({
      reference: results[0].reference,
    }).lean();

    assert.ok(ledgerEntry, "une écriture de caisse doit être créée");
    assert.equal(ledgerEntry.amount, AMOUNT);
    assert.equal(ledgerEntry.church, TEST_CHURCH);
    assert.equal(ledgerEntry.type, "cotisation");
  });

  it("paiement partiel puis complément : cumul correct, référence réutilisée", async () => {
    const member = await makeMember();

    const first = await socialContributionService.recordPayments(
      { memberId: member._id, payments: [{ year: 2025, month: 7, amount: 500 }] },
      admin
    );

    assert.equal(first.results[0].ok, true);
    assert.equal(first.results[0].status, "partiel");
    const firstReference = first.results[0].reference;

    const second = await socialContributionService.recordPayments(
      { memberId: member._id, payments: [{ year: 2025, month: 7, amount: AMOUNT - 500 }] },
      admin
    );

    assert.equal(second.results[0].ok, true);
    assert.equal(second.results[0].status, "paye");
    assert.equal(second.results[0].reference, firstReference);

    const stored = await SocialContribution.findOne({
      member: member._id,
      year: 2025,
      month: 7,
    }).lean();

    assert.equal(stored.amountPaid, AMOUNT);
    assert.equal(stored.status, "paye");

    const ledgerEntries = await SocialLedgerEntry.find({
      reference: firstReference,
    }).lean();

    assert.equal(ledgerEntries.length, 2);
  });

  it("refuse de payer un mois déjà payé", async () => {
    const member = await makeMember();

    await socialContributionService.recordPayments(
      { memberId: member._id, payments: [{ year: 2025, month: 8, amount: AMOUNT }] },
      admin
    );

    const retry = await socialContributionService.recordPayments(
      { memberId: member._id, payments: [{ year: 2025, month: 8, amount: 100 }] },
      admin
    );

    assert.equal(retry.results[0].ok, false);
    assert.equal(retry.results[0].reason, "déjà payé");

    const ledgerEntries = await SocialLedgerEntry.find({
      church: TEST_CHURCH,
      description: { $regex: member.lastName },
    }).lean();

    assert.equal(ledgerEntries.length, 1, "aucun doublon d'écriture de caisse");
  });

  it("paiement multi-mois : un mois déjà payé est signalé sans bloquer les autres", async () => {
    const member = await makeMember();

    await socialContributionService.recordPayments(
      { memberId: member._id, payments: [{ year: 2025, month: 9, amount: AMOUNT }] },
      admin
    );

    const batch = await socialContributionService.recordPayments(
      {
        memberId: member._id,
        payments: [
          { year: 2025, month: 9, amount: AMOUNT },
          { year: 2025, month: 10, amount: AMOUNT },
        ],
      },
      admin
    );

    assert.equal(batch.results.length, 2);

    const sept = batch.results.find((r) => r.month === 9);
    const oct = batch.results.find((r) => r.month === 10);

    assert.equal(sept.ok, false);
    assert.equal(oct.ok, true);
    assert.equal(oct.status, "paye");
    assert.equal(batch.totalPaid, AMOUNT);
  });

  it("refuse un dépassement du montant dû", async () => {
    const member = await makeMember();

    const result = await socialContributionService.recordPayments(
      { memberId: member._id, payments: [{ year: 2025, month: 11, amount: AMOUNT + 1000 }] },
      admin
    );

    assert.equal(result.results[0].ok, false);
    assert.match(result.results[0].reason, /dépasse/);
  });

  it("exonération : exige un motif et refuse une ligne déjà payée", async () => {
    const memberA = await makeMember();
    const memberB = await makeMember();

    const nonPaye = await SocialContribution.create({
      member: memberA._id,
      church: TEST_CHURCH,
      year: 2025,
      month: 12,
      amountDue: AMOUNT,
      status: "non_paye",
    });

    await assert.rejects(() =>
      socialContributionService.exempt(nonPaye._id, {}, admin)
    );

    const exempted = await socialContributionService.exempt(
      nonPaye._id,
      { motif: "Décès dans la famille" },
      admin
    );

    assert.equal(exempted.status, "exonere");
    assert.equal(exempted.exemption.motif, "Décès dans la famille");
    assert.equal(String(exempted.exemption.by), String(admin._id));

    const paye = await SocialContribution.create({
      member: memberB._id,
      church: TEST_CHURCH,
      year: 2025,
      month: 12,
      amountDue: AMOUNT,
      amountPaid: AMOUNT,
      status: "paye",
    });

    await assert.rejects(() =>
      socialContributionService.exempt(paye._id, { motif: "Test" }, admin)
    );
  });

  it("dashboard() et caisse() recalculent le solde depuis les mouvements, jamais une valeur figée", async () => {
    const totalLedger = await SocialLedgerEntry.aggregate([
      { $match: { church: TEST_CHURCH } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const expectedBalance = totalLedger[0]?.total ?? 0;

    const caisse = await socialContributionService.caisse({ church: TEST_CHURCH });
    assert.equal(caisse.openingBalance, 0);
    assert.equal(caisse.totalCotisations, expectedBalance);
    assert.equal(caisse.currentBalance, expectedBalance);

    const dashboard = await socialContributionService.dashboard({ church: TEST_CHURCH });
    assert.equal(dashboard.cashBalance, expectedBalance);
    assert.equal(dashboard.church, TEST_CHURCH);
    assert.equal(dashboard.aidAmountThisMonth, 0);
    assert.equal(dashboard.aidCount, 0);

    // Ajoute un mouvement et vérifie que le solde recalculé bouge en
    // conséquence, preuve qu'il n'est jamais mis en cache.
    const extraMember = await makeMember();

    await socialContributionService.recordPayments(
      { memberId: extraMember._id, payments: [{ year: 2026, month: 1, amount: AMOUNT }] },
      admin
    );

    const caisseAfter = await socialContributionService.caisse({ church: TEST_CHURCH });
    assert.equal(caisseAfter.currentBalance, expectedBalance + AMOUNT);
  });

  it("recherche des membres actifs par nom et rattache l'église", async () => {
    const member = await makeMember({ firstName: "Unique", lastName: "Chercheur" });

    const results = await socialContributionService.searchMembers({
      q: "Chercheur",
      church: TEST_CHURCH,
    });

    assert.ok(results.some((m) => String(m._id) === String(member._id)));
  });
});
