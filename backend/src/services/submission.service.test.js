import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import Flock from "../models/Flock.js";
import Member from "../models/Member.js";
import MemberSubmission from "../models/MemberSubmission.js";
import RegistrationCounter from "../models/RegistrationCounter.js";
import * as submissionService from "./submission.service.js";

// Isolation :
//
// - Member/MemberSubmission : un nom de famille improbable en
//   production ("TestSuiteSubmission"), jamais une purge large.
// - Flock : des codes improbables ("ZZ", "YY"), sur des églises
//   réelles (1 et 2) — le champ `church` de Flock et de Member est
//   contraint à 1-5 par le schéma, impossible d'utiliser une église
//   fictive ici comme pour RegistrationCounter seul.
// - RegistrationCounter de l'église 1 : RÉEL et déjà peuplé (44,
//   après l'import du registre papier). Le test qui approuve une
//   nouvelle inscription l'incrémente forcément (c'est le
//   comportement testé) ; sa valeur exacte est lue avant et restaurée
//   au centime près après, pour ne jamais laisser le compteur réel
//   dans un état différent de celui trouvé au départ.
const TEST_LAST_NAME = "TestSuiteSubmission";
const FLOCK_CODE = "ZZ";
const OTHER_FLOCK_CODE = "YY";

let testFlockChurch1;
let testFlockChurch2;
let originalCounterChurch1;

const cleanupPeople = async () => {
  await Member.deleteMany({ lastName: TEST_LAST_NAME });
  await MemberSubmission.deleteMany({ "data.lastName": TEST_LAST_NAME });
};

describe("submission.service (intégration MongoDB)", () => {
  before(async () => {
    await connectTestDb();
    await Promise.all([
      Flock.init(),
      Member.init(),
      MemberSubmission.init(),
      RegistrationCounter.init(),
    ]);

    testFlockChurch1 = await Flock.create({
      code: FLOCK_CODE,
      name: "Bergerie Test Suite",
      church: 1,
    });

    testFlockChurch2 = await Flock.create({
      code: OTHER_FLOCK_CODE,
      name: "Bergerie Test Suite (autre église)",
      church: 2,
    });

    const counter = await RegistrationCounter.findOne({ church: 1 }).lean();
    originalCounterChurch1 = counter?.lastNumber ?? null;
  });

  beforeEach(cleanupPeople);
  afterEach(cleanupPeople);

  after(async () => {
    await cleanupPeople();
    await Flock.deleteMany({ code: { $in: [FLOCK_CODE, OTHER_FLOCK_CODE] } });

    // Restaure EXACTEMENT la valeur réelle du compteur de l'église 1
    // trouvée au démarrage de la suite, quel que soit le nombre de
    // matricules générés entretemps par les tests.
    if (originalCounterChurch1 === null) {
      await RegistrationCounter.deleteOne({ church: 1 });
    } else {
      await RegistrationCounter.updateOne(
        { church: 1 },
        { $set: { lastNumber: originalCounterChurch1 } }
      );
    }

    await disconnectTestDb();
  });

  // ---- submit() -----------------------------------------------------

  it("submit() rejette un type invalide", async () => {
    await assert.rejects(
      submissionService.submit({
        type: "autre",
        data: { firstName: "Jean", lastName: TEST_LAST_NAME },
      }),
      (error) => error.status === 400
    );
  });

  it("submit() exige prénom et nom", async () => {
    await assert.rejects(
      submissionService.submit({
        type: "new",
        data: { firstName: "", lastName: "" },
      }),
      (error) => error.status === 400
    );
  });

  it("submit() de type 'update' exige un matricule", async () => {
    await assert.rejects(
      submissionService.submit({
        type: "update",
        registrationNumber: "",
        data: { firstName: "Jean", lastName: TEST_LAST_NAME },
      }),
      (error) => error.status === 400
    );
  });

  it("submit() filtre les champs non autorisés (ex. `status`) et crée une soumission en attente", async () => {
    const result = await submissionService.submit({
      type: "new",
      data: {
        firstName: "Jean",
        lastName: TEST_LAST_NAME,
        church: 1,
        flock: String(testFlockChurch1._id),
        phone: "0700000000",
        status: "admin", // doit être filtré
      },
    });

    assert.deepEqual(result, { received: true });

    const stored = await MemberSubmission.findOne({
      "data.lastName": TEST_LAST_NAME,
    }).lean();

    assert.equal(stored.status, "pending");
    assert.equal(stored.type, "new");
    assert.equal(stored.data.status, undefined);
    assert.equal(stored.data.phone, "0700000000");
  });

  it("submit() de type 'update' résout `existingMember` quand le matricule correspond à un membre informatisé", async () => {
    const existingMember = await Member.create({
      firstName: "Existant",
      lastName: TEST_LAST_NAME,
      registrationNumber: "1ZZ99001A",
      church: 1,
      flock: testFlockChurch1._id,
    });

    await submissionService.submit({
      type: "update",
      registrationNumber: "1zz99-001 a",
      data: { firstName: "Existant", lastName: TEST_LAST_NAME, phone: "0711111111" },
    });

    const stored = await MemberSubmission.findOne({
      "data.lastName": TEST_LAST_NAME,
    }).lean();

    assert.equal(String(stored.existingMember), String(existingMember._id));
    assert.equal(stored.submittedRegistrationNumber, "1ZZ99001A");
  });

  // ---- listPending() / getById() ------------------------------------

  it("listPending() renvoie les soumissions en attente avec la métadonnée de pagination", async () => {
    await submissionService.submit({
      type: "new",
      data: { firstName: "Jean", lastName: TEST_LAST_NAME },
    });

    const { items, meta } = await submissionService.listPending({
      page: 1,
      limit: 10,
    });

    const found = items.find((item) => item.data.lastName === TEST_LAST_NAME);

    assert.ok(found, "la soumission créée doit apparaître dans la liste");
    assert.equal(found.status, "pending");
    assert.ok(meta.total >= 1);
  });

  it("getById() renvoie la soumission et `currentMember: null` en l'absence de membre existant", async () => {
    await submissionService.submit({
      type: "new",
      data: { firstName: "Jean", lastName: TEST_LAST_NAME },
    });

    const created = await MemberSubmission.findOne({
      "data.lastName": TEST_LAST_NAME,
    }).lean();

    const { submission, currentMember } = await submissionService.getById(
      created._id
    );

    assert.equal(String(submission._id), String(created._id));
    assert.equal(currentMember, null);
  });

  it("getById() lève une 404 pour une soumission introuvable", async () => {
    await assert.rejects(
      submissionService.getById(new mongoose.Types.ObjectId()),
      (error) => error.status === 404
    );
  });

  // ---- approve() ------------------------------------------------------

  it("approve() crée un nouveau membre avec un matricule généré et marque la soumission comme approuvée", async () => {
    await submissionService.submit({
      type: "new",
      data: {
        firstName: "Nouveau",
        lastName: TEST_LAST_NAME,
        church: 1,
        flock: String(testFlockChurch1._id),
        phone: "0700000002",
      },
    });

    const pending = await MemberSubmission.findOne({
      "data.lastName": TEST_LAST_NAME,
    }).lean();

    const { member, submission } = await submissionService.approve(
      pending._id,
      { user: { id: new mongoose.Types.ObjectId() } }
    );

    assert.match(member.registrationNumber, /^1ZZ\d{2}\d{3}[A-Z]$/);
    assert.equal(submission.status, "approved");
    assert.ok(submission.processedAt);
  });

  it("approve() met à jour un membre existant plutôt que d'en créer un nouveau (parcours 'update')", async () => {
    const existingMember = await Member.create({
      firstName: "Existant",
      lastName: TEST_LAST_NAME,
      registrationNumber: "1ZZ99002B",
      church: 1,
      flock: testFlockChurch1._id,
      phone: "0700000000",
    });

    await submissionService.submit({
      type: "update",
      registrationNumber: "1ZZ99002B",
      data: { firstName: "Existant", lastName: TEST_LAST_NAME, phone: "0722222222" },
    });

    const pending = await MemberSubmission.findOne({
      "data.lastName": TEST_LAST_NAME,
    }).lean();

    const { member } = await submissionService.approve(pending._id, {
      overrides: { church: 1, flock: String(testFlockChurch1._id) },
      user: { id: new mongoose.Types.ObjectId() },
    });

    assert.equal(String(member._id), String(existingMember._id));
    assert.equal(member.phone, "0722222222");
    // Le matricule d'origine n'est jamais réattribué lors d'une mise à
    // jour.
    assert.equal(member.registrationNumber, "1ZZ99002B");

    const countAfter = await Member.countDocuments({
      lastName: TEST_LAST_NAME,
    });
    assert.equal(countAfter, 1, "aucun second membre ne doit être créé");
  });

  it("approve() lève une 422 si l'église ou la bergerie sont absentes", async () => {
    await submissionService.submit({
      type: "new",
      data: { firstName: "Incomplet", lastName: TEST_LAST_NAME },
    });

    const pending = await MemberSubmission.findOne({
      "data.lastName": TEST_LAST_NAME,
    }).lean();

    await assert.rejects(
      submissionService.approve(pending._id, {
        user: { id: new mongoose.Types.ObjectId() },
      }),
      (error) => error.status === 422
    );
  });

  it("approve() lève une 400 si la bergerie n'appartient pas à l'église indiquée", async () => {
    await submissionService.submit({
      type: "new",
      data: {
        firstName: "Incoherent",
        lastName: TEST_LAST_NAME,
        church: 1,
        // Bergerie de l'église 2, pour une soumission déclarée église 1.
        flock: String(testFlockChurch2._id),
      },
    });

    const pending = await MemberSubmission.findOne({
      "data.lastName": TEST_LAST_NAME,
    }).lean();

    await assert.rejects(
      submissionService.approve(pending._id, {
        user: { id: new mongoose.Types.ObjectId() },
      }),
      (error) => error.status === 400
    );
  });

  it("approve() lève une 409 sur une soumission déjà traitée", async () => {
    await submissionService.submit({
      type: "new",
      data: {
        firstName: "DejaTraite",
        lastName: TEST_LAST_NAME,
        church: 1,
        flock: String(testFlockChurch1._id),
      },
    });

    const pending = await MemberSubmission.findOne({
      "data.lastName": TEST_LAST_NAME,
    }).lean();

    await submissionService.approve(pending._id, {
      user: { id: new mongoose.Types.ObjectId() },
    });

    await assert.rejects(
      submissionService.approve(pending._id, {
        user: { id: new mongoose.Types.ObjectId() },
      }),
      (error) => error.status === 409
    );
  });

  it("approve() lève une 404 pour une soumission introuvable", async () => {
    await assert.rejects(
      submissionService.approve(new mongoose.Types.ObjectId(), {
        user: { id: new mongoose.Types.ObjectId() },
      }),
      (error) => error.status === 404
    );
  });

  // ---- reject() ---------------------------------------------------

  it("reject() rejette une soumission et enregistre le motif", async () => {
    await submissionService.submit({
      type: "new",
      data: { firstName: "ARejeter", lastName: TEST_LAST_NAME },
    });

    const pending = await MemberSubmission.findOne({
      "data.lastName": TEST_LAST_NAME,
    }).lean();

    const rejected = await submissionService.reject(pending._id, {
      reason: "Motif de test",
      user: { id: new mongoose.Types.ObjectId() },
    });

    assert.equal(rejected.status, "rejected");
    assert.equal(rejected.rejectionReason, "Motif de test");
  });

  it("reject() lève une 409 sur une soumission déjà traitée", async () => {
    await submissionService.submit({
      type: "new",
      data: { firstName: "DejaTraite2", lastName: TEST_LAST_NAME },
    });

    const pending = await MemberSubmission.findOne({
      "data.lastName": TEST_LAST_NAME,
    }).lean();

    await submissionService.reject(pending._id, {
      reason: "Premier motif",
      user: { id: new mongoose.Types.ObjectId() },
    });

    await assert.rejects(
      submissionService.reject(pending._id, {
        reason: "Second motif",
        user: { id: new mongoose.Types.ObjectId() },
      }),
      (error) => error.status === 409
    );
  });

  it("reject() lève une 404 pour une soumission introuvable", async () => {
    await assert.rejects(
      submissionService.reject(new mongoose.Types.ObjectId(), {
        reason: "Motif",
        user: { id: new mongoose.Types.ObjectId() },
      }),
      (error) => error.status === 404
    );
  });
});
