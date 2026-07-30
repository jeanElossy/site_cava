import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import Member from "./Member.js";

// Isolation : un nom de famille improbable en production, jamais une
// purge large de la collection, pour ne jamais toucher un membre réel.
const TEST_LAST_NAME = "TestSuiteInscription";

const cleanup = () => Member.deleteMany({ lastName: TEST_LAST_NAME });

describe("Member (modèle) — champs d'inscription (intégration MongoDB)", () => {
  before(async () => {
    await connectTestDb();
    await Member.init();
  });

  beforeEach(cleanup);
  after(async () => {
    await cleanup();
    await disconnectTestDb();
  });

  it("accepte un matricule valide et les nouveaux champs (état civil, baptême, compétences)", async () => {
    const member = await Member.create({
      firstName: "Test",
      lastName: TEST_LAST_NAME,
      registrationNumber: "1zz16005e",
      church: 1,
      gender: "homme",
      maritalStatus: "marie",
      childrenCount: 2,
      baptism: { water: true, waterYear: 2020, holySpirit: true },
      skills: ["musique", "accueil"],
    });

    assert.equal(member.registrationNumber, "1ZZ16005E");
    assert.equal(member.church, 1);
    assert.equal(member.baptism.water, true);
    assert.equal(member.baptism.waterYear, 2020);
    assert.deepEqual(member.skills, ["musique", "accueil"]);
  });

  it("rejette un matricule de forme invalide", async () => {
    await assert.rejects(
      Member.create({
        firstName: "Test",
        lastName: TEST_LAST_NAME,
        registrationNumber: "PAS-UN-MATRICULE",
      })
    );
  });

  it("rejette un doublon de matricule", async () => {
    await Member.create({
      firstName: "Premier",
      lastName: TEST_LAST_NAME,
      registrationNumber: "1ZZ16005E",
    });

    await assert.rejects(
      Member.create({
        firstName: "Doublon",
        lastName: TEST_LAST_NAME,
        registrationNumber: "1ZZ16005E",
      }),
      (error) => error.code === 11000
    );
  });

  it("autorise plusieurs membres sans matricule (sparse index)", async () => {
    await Member.create({ firstName: "Sans1", lastName: TEST_LAST_NAME });
    await Member.create({ firstName: "Sans2", lastName: TEST_LAST_NAME });

    const count = await Member.countDocuments({ lastName: TEST_LAST_NAME });
    assert.equal(count, 2);
  });

  it("rejette un genre hors de l'énumération autorisée", async () => {
    await assert.rejects(
      Member.create({
        firstName: "Test",
        lastName: TEST_LAST_NAME,
        gender: "autre",
      })
    );
  });

  it("rejette une église hors de la plage 1-5", async () => {
    await assert.rejects(
      Member.create({
        firstName: "Test",
        lastName: TEST_LAST_NAME,
        church: 9,
      })
    );
  });

  it("initialise emergencyContact et baptism à des sous-objets vides par défaut", async () => {
    const member = await Member.create({
      firstName: "Test",
      lastName: TEST_LAST_NAME,
    });

    assert.deepEqual(member.baptism.water, false);
    assert.deepEqual(member.baptism.holySpirit, false);
    assert.equal(member.emergencyContact.name, undefined);
  });
});
