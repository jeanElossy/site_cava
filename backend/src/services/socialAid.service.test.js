import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import Member from "../models/Member.js";
import User from "../models/User.js";
import SocialFundSettings from "../models/SocialFundSettings.js";
import SocialAid from "../models/SocialAid.js";
import SocialAidType from "../models/SocialAidType.js";
import SocialContribution from "../models/SocialContribution.js";
import SocialLedgerEntry from "../models/SocialLedgerEntry.js";
import * as socialAidService from "./socialAid.service.js";
import * as socialContributionService from "./socialContribution.service.js";

// ------------------------------------------------------------------
// ÉGLISE DE TEST : 4, PAS 5
// ------------------------------------------------------------------
// Member.church rejette 9 (voir l'écart déjà documenté en tête de
// socialContribution.service.test.js), donc une église réelle de la
// plage 1-5 est nécessaire. L'église 5 est déjà utilisée par
// socialContribution.service.test.js ET social.routes.test.js pour
// leurs propres SocialFundSettings/SocialContribution/SocialLedgerEntry
// de test. Chaque fichier `node --test` s'exécute dans son PROPRE
// PROCESSUS, concurremment (voir test/db.js) : réutiliser l'église 5
// ici ferait de ce fichier un troisième intervenant sur le même
// document `SocialFundSettings` (unique par église) et sur les mêmes
// `Member`/`SocialContribution` de l'église 5, avec un risque réel de
// collision (constaté empiriquement en écrivant ce fichier : les
// `deleteMany({ church: 5 })` d'un fichier suppriment en plein vol les
// fixtures d'un autre — même classe de bug déjà documentée dans
// newSoul.service.test.js à propos de newSouls.routes.test.js).
//
// L'église 4 est utilisée par newSoul.service.test.js, mais UNIQUEMENT
// pour des `Member` nettoyés par `flock._id` (jamais par un
// `deleteMany({ church: 4 })` en masse — vérifié en lisant ce fichier),
// et par AUCUN autre fichier pour `SocialFundSettings` : donc aucune
// collision possible sur les modèles du Service Social. Vérifié en
// base avant écriture : 0 membre réel et aucun `SocialFundSettings`
// existant sur l'église 4 à ce jour (seule l'église 1 est active en
// pratique, avec 60 membres réels — jamais utilisée pour un test).
const TEST_CHURCH = 4;
const OPENING_BALANCE = 10000;
const AID_TYPE_NAME_PREFIX = "Test Aide Sociale";

let admin;
let aidType;

const cleanup = async () => {
  await SocialAid.deleteMany({ church: TEST_CHURCH });
  await SocialLedgerEntry.deleteMany({ church: TEST_CHURCH });
  // Ce fichier crée un `SocialFundSettings(church: 4)` pendant toute sa
  // durée : si le serveur de dev tourne en parallèle (même base
  // partagée, voir CLAUDE.md), son job planifié
  // (socialContributionsGenerator.js, relancé à chaque redémarrage
  // --watch) peut générer des `SocialContribution` pour les membres de
  // test actifs de ce fichier avant qu'ils ne soient supprimés
  // ci-dessous — laissant des lignes orphelines (`member` inexistant)
  // dans la page Offrandes. Constaté concrètement en base de
  // production (62 lignes orphelines, église 4) au cours de cette
  // session.
  await SocialContribution.deleteMany({ church: TEST_CHURCH });
  await Member.deleteMany({ church: TEST_CHURCH });
  await SocialFundSettings.deleteMany({ church: TEST_CHURCH });
  // SocialAidType est une collection GLOBALE (pas de champ church) :
  // le nettoyage cible donc explicitement les types créés par cette
  // suite, par préfixe de nom, pour ne jamais toucher un vrai type
  // d'aide de production.
  await SocialAidType.deleteMany({
    name: { $regex: `^${AID_TYPE_NAME_PREFIX}` },
  });
};

const makeMember = (overrides = {}) =>
  Member.create({
    firstName: "Test",
    lastName: `AideSociale ${Math.random().toString(36).slice(2, 8)}`,
    church: TEST_CHURCH,
    status: "actif",
    ...overrides,
  });

describe("socialAid.service (intégration MongoDB)", () => {
  before(async () => {
    await connectTestDb();
    await cleanup();

    // PAS de `.lean()` : le service lit `user.id`, un virtuel Mongoose
    // absent d'un document "lean" — même piège documenté dans
    // socialContribution.service.test.js.
    admin = await User.findOne({ role: "admin" });

    if (!admin) {
      admin = await User.create({
        name: "Admin Test Aide Sociale",
        email: "admin.socialaid.testsuite@example.invalid",
        password: "MotDePasseTemporaire123!",
        role: "admin",
      });
    }

    await SocialFundSettings.create({
      church: TEST_CHURCH,
      monthlyContributionAmount: 1000,
      openingBalance: OPENING_BALANCE,
    });

    aidType = await SocialAidType.create({
      name: `${AID_TYPE_NAME_PREFIX} ${Math.random().toString(36).slice(2, 8)}`,
      active: true,
      createdBy: admin._id,
    });
  });

  after(async () => {
    await cleanup();
    await disconnectTestDb();
  });

  it("crée une aide en_attente, sans référence assignée", async () => {
    const member = await makeMember();

    const aid = await socialAidService.createAid(
      {
        memberId: member._id,
        aidTypeId: aidType._id,
        amount: 2000,
        motif: "Frais médicaux",
      },
      admin
    );

    assert.equal(aid.status, "en_attente");
    assert.equal(aid.reference, undefined);
    assert.equal(aid.church, TEST_CHURCH);
    assert.equal(aid.aidType.name, aidType.name);
    assert.equal(String(aid.requestedBy), String(admin._id));
  });

  it("refuse un type d'aide invalide sans jamais affecter le premier type actif venu", async () => {
    const member = await makeMember();

    await assert.rejects(
      () =>
        socialAidService.createAid(
          { memberId: member._id, aidTypeId: undefined, amount: 1000, motif: "Test" },
          admin
        ),
      (error) => {
        assert.equal(error.status, 422);
        return true;
      }
    );
  });

  it("validation réussie : statut payée, référence générée, écriture négative, solde diminué", async () => {
    const member = await makeMember();
    const amount = 3000;

    const aid = await socialAidService.createAid(
      { memberId: member._id, aidTypeId: aidType._id, amount, motif: "Décès" },
      admin
    );

    const balanceBefore = await socialContributionService.computeCashBalance(TEST_CHURCH);

    const result = await socialAidService.validateAid(aid._id, admin);

    assert.equal(result.status, "payee");
    assert.match(result.reference, /^AIDE-\d{4}-\d{5}$/);
    assert.ok(result.paidAt);
    assert.equal(String(result.decidedBy), String(admin._id));

    const ledgerEntry = await SocialLedgerEntry.findOne({
      reference: result.reference,
    }).lean();

    assert.ok(ledgerEntry, "une écriture de caisse doit être créée");
    assert.equal(ledgerEntry.type, "aide");
    assert.equal(ledgerEntry.amount, -amount);

    const balanceAfter = await socialContributionService.computeCashBalance(TEST_CHURCH);
    assert.equal(balanceAfter, balanceBefore - amount);
  });

  it("validation refusée si le solde est insuffisant (409, aucune écriture, statut inchangé)", async () => {
    const member = await makeMember();
    const balance = await socialContributionService.computeCashBalance(TEST_CHURCH);

    const aid = await socialAidService.createAid(
      {
        memberId: member._id,
        aidTypeId: aidType._id,
        amount: balance + 1000,
        motif: "Montant trop élevé",
      },
      admin
    );

    await assert.rejects(
      () => socialAidService.validateAid(aid._id, admin),
      (error) => {
        assert.equal(error.status, 409);
        return true;
      }
    );

    const stored = await SocialAid.findById(aid._id).lean();
    assert.equal(stored.status, "en_attente");
    assert.equal(stored.reference, undefined);

    const ledgerEntries = await SocialLedgerEntry.find({
      church: TEST_CHURCH,
      type: "aide",
      description: { $regex: member.lastName },
    }).lean();
    assert.equal(ledgerEntries.length, 0);
  });

  it("refus exige un motif", async () => {
    const member = await makeMember();

    const aid = await socialAidService.createAid(
      { memberId: member._id, aidTypeId: aidType._id, amount: 1000, motif: "Test refus" },
      admin
    );

    await assert.rejects(
      () => socialAidService.refuseAid(aid._id, {}, admin),
      (error) => {
        assert.equal(error.status, 422);
        return true;
      }
    );

    const refused = await socialAidService.refuseAid(
      aid._id,
      { motif: "Dossier incomplet" },
      admin
    );

    assert.equal(refused.status, "refusee");
    assert.equal(refused.decisionNote, "Dossier incomplet");
  });

  it("validation/refus refusés si l'aide n'est pas en_attente (déjà tranchée)", async () => {
    const member = await makeMember();

    const aid = await socialAidService.createAid(
      { memberId: member._id, aidTypeId: aidType._id, amount: 500, motif: "Déjà refusée" },
      admin
    );

    await socialAidService.refuseAid(aid._id, { motif: "Non éligible" }, admin);

    await assert.rejects(
      () => socialAidService.validateAid(aid._id, admin),
      (error) => {
        assert.equal(error.status, 409);
        return true;
      }
    );

    await assert.rejects(
      () => socialAidService.refuseAid(aid._id, { motif: "Encore" }, admin),
      (error) => {
        assert.equal(error.status, 409);
        return true;
      }
    );
  });

  it("annulation d'une aide payée : statut annulée, compensation positive, solde restauré", async () => {
    const member = await makeMember();
    const amount = 1500;

    const aid = await socialAidService.createAid(
      { memberId: member._id, aidTypeId: aidType._id, amount, motif: "À annuler" },
      admin
    );

    const balanceBeforeDecaissement = await socialContributionService.computeCashBalance(
      TEST_CHURCH
    );

    const validated = await socialAidService.validateAid(aid._id, admin);

    const cancelled = await socialAidService.cancelAid(
      validated._id,
      { motif: "Erreur de saisie" },
      admin
    );

    assert.equal(cancelled.status, "annulee");
    assert.equal(cancelled.cancelReason, "Erreur de saisie");
    assert.equal(String(cancelled.cancelledBy), String(admin._id));

    const compensation = await SocialLedgerEntry.findOne({
      type: "aide_annulation",
      reference: validated.reference,
    }).lean();

    assert.ok(compensation, "une écriture de compensation doit être créée");
    assert.equal(compensation.amount, amount);

    // L'écriture originale (négative) n'a pas été modifiée.
    const original = await SocialLedgerEntry.findOne({
      type: "aide",
      reference: validated.reference,
    }).lean();
    assert.equal(original.amount, -amount);

    const balanceAfterCancel = await socialContributionService.computeCashBalance(TEST_CHURCH);
    assert.equal(balanceAfterCancel, balanceBeforeDecaissement);
  });

  it("annulation refusée si l'aide n'est pas payée (ex. encore en_attente)", async () => {
    const member = await makeMember();

    const aid = await socialAidService.createAid(
      { memberId: member._id, aidTypeId: aidType._id, amount: 800, motif: "Pas encore payée" },
      admin
    );

    await assert.rejects(
      () => socialAidService.cancelAid(aid._id, { motif: "Test" }, admin),
      (error) => {
        assert.equal(error.status, 409);
        return true;
      }
    );
  });

  it("dashboard() reflète aidAmountThisMonth/aidCount après une validation", async () => {
    const before = await socialContributionService.dashboard({ church: TEST_CHURCH });

    const member = await makeMember();
    const amount = 700;

    const aid = await socialAidService.createAid(
      { memberId: member._id, aidTypeId: aidType._id, amount, motif: "Pour dashboard" },
      admin
    );

    await socialAidService.validateAid(aid._id, admin);

    const after = await socialContributionService.dashboard({ church: TEST_CHURCH });

    assert.equal(after.aidAmountThisMonth, before.aidAmountThisMonth + amount);
    assert.equal(after.aidCount, before.aidCount + 1);
  });
});
