import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";

import User from "../models/User.js";
import Member from "../models/Member.js";
import SocialFundSettings from "../models/SocialFundSettings.js";
import SocialFundYear from "../models/SocialFundYear.js";
import SocialLedgerEntry from "../models/SocialLedgerEntry.js";
import SocialContribution from "../models/SocialContribution.js";

import * as fundYear from "./socialFundYear.service.js";
import * as contributions from "./socialContribution.service.js";

// ------------------------------------------------------------------
// ÉGLISE DE TEST
// ------------------------------------------------------------------
// Église 3 : dans la plage 1-5 valide pour `Member` (l'église fictive
// 9 de la consigne projet est refusée par ce modèle), et distincte des
// églises 4 et 5 déjà réservées par les deux autres suites du module —
// deux fichiers `node --test` s'exécutent dans des processus séparés
// mais partagent LA MÊME base (voir CLAUDE.md).
//
// Tout appel de génération est cantonné à cette église : sans filtre,
// il régénérerait les offrandes réelles des églises de production.
const TEST_CHURCH = 3;
const AMOUNT = 1000;

let admin;

const cleanup = async () => {
  await SocialContribution.deleteMany({ church: TEST_CHURCH });
  await SocialLedgerEntry.deleteMany({ church: TEST_CHURCH });
  await SocialFundYear.deleteMany({ church: TEST_CHURCH });
  await Member.deleteMany({ church: TEST_CHURCH });
  await SocialFundSettings.deleteMany({ church: TEST_CHURCH });
};

describe("socialFundYear.service — caisses annuelles (intégration MongoDB)", () => {
  before(async () => {
    await connectTestDb();
    await cleanup();

    // PAS de `.lean()` : le service lit `user.id`, un virtuel Mongoose
    // absent d'un document « lean ».
    admin = await User.findOne({ role: "admin" });

    if (!admin) {
      admin = await User.create({
        name: "Admin Test Exercices",
        email: "admin.exercices.testsuite@example.invalid",
        password: "MotDePasseTemporaire123!",
        role: "admin",
      });
    }

    await SocialFundSettings.create({
      church: TEST_CHURCH,
      monthlyContributionAmount: AMOUNT,
    });
  });

  after(async () => {
    await cleanup();
    await disconnectTestDb();
  });

  // ORDRE IMPORTANT : le solde de reprise ne se saisit que pour le TOUT
  // PREMIER exercice d'une église — pour les suivants c'est un report
  // calculé, qu'une saisie libre pourrait contredire. Ce test doit donc
  // s'exécuter avant qu'aucun exercice n'existe.
  it("refuse un solde de reprise négatif", async () => {
    await assert.rejects(() =>
      fundYear.openFundYear(
        TEST_CHURCH,
        { year: fundYear.SOCIAL_START_YEAR, openingBalance: -1 },
        admin
      )
    );

    assert.equal(await SocialFundYear.countDocuments({ church: TEST_CHURCH }), 0);
  });

  it("ouvre le premier exercice avec le solde de reprise saisi", async () => {
    const opened = await fundYear.openFundYear(
      TEST_CHURCH,
      { year: fundYear.SOCIAL_START_YEAR, openingBalance: 5000 },
      admin
    );

    assert.equal(opened.year, fundYear.SOCIAL_START_YEAR);
    assert.equal(opened.openingBalance, 5000);
    assert.equal(opened.status, "ouvert");
  });

  it("refuse de rouvrir un exercice déjà ouvert", async () => {
    await assert.rejects(() =>
      fundYear.openFundYear(
        TEST_CHURCH,
        { year: fundYear.SOCIAL_START_YEAR, openingBalance: 0 },
        admin
      )
    );
  });

  it("rattache un mouvement à l'exercice de l'année courante", async () => {
    const entry = await fundYear.recordLedgerEntry(
      {
        church: TEST_CHURCH,
        type: "cotisation",
        reference: "TEST-EXO-1",
        description: "Test exercice",
        amount: 2000,
      },
      admin
    );

    assert.equal(entry.year, fundYear.currentYear());

    const balance = await fundYear.computeYearBalance(
      TEST_CHURCH,
      fundYear.currentYear()
    );

    assert.equal(balance.totalIn, 2000);
    assert.equal(balance.totalOut, 0);
  });

  it("sépare entrées et sorties, et n'additionne que l'exercice demandé", async () => {
    await fundYear.recordLedgerEntry(
      {
        church: TEST_CHURCH,
        type: "aide",
        reference: "TEST-EXO-2",
        description: "Sortie de test",
        amount: -500,
      },
      admin
    );

    const current = await fundYear.computeYearBalance(
      TEST_CHURCH,
      fundYear.currentYear()
    );

    assert.equal(current.totalIn, 2000);
    assert.equal(current.totalOut, 500);

    // L'exercice 2024 n'a reçu aucun mouvement : il ne doit rien voir
    // de ceux de l'année en cours.
    const first = await fundYear.computeYearBalance(
      TEST_CHURCH,
      fundYear.SOCIAL_START_YEAR
    );

    assert.equal(first.totalIn, 0);
    assert.equal(first.totalOut, 0);
    assert.equal(first.currentBalance, 5000);
  });

  it("reporte le solde de clôture sur l'exercice suivant, créé automatiquement", async () => {
    const closed = await fundYear.closeFundYear(
      TEST_CHURCH,
      fundYear.SOCIAL_START_YEAR,
      admin
    );

    assert.equal(closed.closed.status, "cloture");
    assert.equal(closed.closed.closingBalance, 5000);

    assert.ok(closed.next, "l'exercice suivant doit être ouvert");
    assert.equal(closed.next.year, fundYear.SOCIAL_START_YEAR + 1);
    assert.equal(
      closed.next.openingBalance,
      5000,
      "le solde doit être reporté, pas remis à zéro"
    );
  });

  it("refuse d'encaisser dans un exercice clôturé, et le redit clairement", async () => {
    const year = fundYear.currentYear();

    await fundYear.closeFundYear(TEST_CHURCH, year, admin);

    await assert.rejects(
      () =>
        fundYear.recordLedgerEntry(
          {
            church: TEST_CHURCH,
            type: "cotisation",
            reference: "TEST-EXO-3",
            description: "Doit échouer",
            amount: 100,
          },
          admin
        ),
      (error) => /clôturé/.test(error.message)
    );
  });

  it("bloque un paiement d'offrande AVANT de toucher la cotisation quand la caisse est clôturée", async () => {
    const member = await Member.create({
      firstName: "Exercice",
      lastName: "Clôturé",
      church: TEST_CHURCH,
      status: "actif",
    });

    await assert.rejects(() =>
      contributions.recordPayments(
        {
          memberId: member._id,
          payments: [{ year: fundYear.currentYear(), month: 1, amount: AMOUNT }],
        },
        admin
      )
    );

    // Le point du garde-fou : AUCUNE cotisation n'a été marquée payée
    // alors que le journal de caisse n'a rien pu enregistrer.
    const paid = await SocialContribution.countDocuments({
      member: member._id,
      status: { $in: ["paye", "partiel"] },
    });

    assert.equal(paid, 0);
  });

  it("rouvre un exercice clôturé et permet de nouveau d'encaisser", async () => {
    const year = fundYear.currentYear();

    const reopened = await fundYear.reopenFundYear(TEST_CHURCH, year, admin);

    assert.equal(reopened.status, "ouvert");
    assert.equal(reopened.closingBalance, undefined);

    const entry = await fundYear.recordLedgerEntry(
      {
        church: TEST_CHURCH,
        type: "cotisation",
        reference: "TEST-EXO-4",
        description: "Après réouverture",
        amount: 300,
      },
      admin
    );

    assert.equal(entry.year, year);
  });
});
