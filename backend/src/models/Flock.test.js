import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import Flock from "./Flock.js";

// `church` doit rester dans la plage réelle 1-5 (contrainte du
// schéma) : impossible d'isoler ces tests avec une église fictive
// comme pour RegistrationCounter. On isole donc par CODE, avec des
// codes improbables en production ("ZZ", "YY"), et on ne supprime que
// ces codes précis — jamais une purge large de la collection — pour
// ne jamais toucher une bergerie réelle.
const TEST_CHURCH = 5;
const TEST_CODES = ["ZZ", "YY"];

const cleanup = () => Flock.deleteMany({ code: { $in: TEST_CODES } });

describe("Flock (modèle)", () => {
  before(async () => {
    await connectTestDb();
  });

  beforeEach(cleanup);
  after(async () => {
    await cleanup();
    await disconnectTestDb();
  });

  it("met le code en majuscules", async () => {
    const flock = await Flock.create({
      code: "zz",
      name: "Bergerie de test",
      church: TEST_CHURCH,
    });

    assert.equal(flock.code, "ZZ");
  });

  it("rejette un code qui n'a pas exactement 2 lettres", async () => {
    await assert.rejects(
      Flock.create({ code: "ZZZ", name: "Test", church: TEST_CHURCH })
    );
    await assert.rejects(
      Flock.create({ code: "Z", name: "Test", church: TEST_CHURCH })
    );
  });

  it("exige name et church", async () => {
    await assert.rejects(Flock.create({ code: "ZZ" }));
  });

  it("applique le statut par défaut 'published'", async () => {
    const flock = await Flock.create({
      code: "ZZ",
      name: "Bergerie de test",
      church: TEST_CHURCH,
    });

    assert.equal(flock.status, "published");
  });

  it("autorise le même code dans deux églises différentes", async () => {
    await Flock.create({
      code: "ZZ",
      name: "Bergerie de test",
      church: TEST_CHURCH,
    });

    // Église réelle différente, avec le même code : ne doit pas être
    // bloqué par l'index composé { church, code }.
    const other = await Flock.create({
      code: "ZZ",
      name: "Bergerie de test (autre église)",
      church: TEST_CHURCH === 1 ? 2 : 1,
    });

    assert.equal(other.code, "ZZ");
  });

  it("rejette un doublon { church, code }", async () => {
    await Flock.create({
      code: "ZZ",
      name: "Bergerie de test",
      church: TEST_CHURCH,
    });

    await assert.rejects(
      Flock.create({
        code: "ZZ",
        name: "Doublon",
        church: TEST_CHURCH,
      }),
      (error) => error.code === 11000
    );
  });
});
