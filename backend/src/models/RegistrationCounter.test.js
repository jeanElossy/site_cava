import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import RegistrationCounter from "./RegistrationCounter.js";

// Église fictive, hors plage réelle (1-5) utilisée en production.
//
// Le modèle n'est JAMAIS créé via `.create()` en usage réel : seul
// `findOneAndUpdate` + `$inc` (upsert) l'alimente, dans
// registrationNumber.service.js, sans exécuter les validateurs. Les
// tests d'intégration ci-dessous reproduisent donc fidèlement ce
// chemin réel plutôt que `.create()`, pour ne jamais toucher le
// compteur d'une église existante en production.
const TEST_CHURCH = 9;

describe("RegistrationCounter (modèle) — validation du schéma (sans base)", () => {
  it("exige `church`", () => {
    const doc = new RegistrationCounter({});
    const error = doc.validateSync();

    assert.ok(error);
    assert.ok(error.errors.church);
  });

  it("refuse une église hors de la plage 1-5", () => {
    const tooLow = new RegistrationCounter({ church: 0 });
    const tooHigh = new RegistrationCounter({ church: 6 });

    assert.ok(tooLow.validateSync().errors.church);
    assert.ok(tooHigh.validateSync().errors.church);
  });

  it("accepte une église dans la plage 1-5", () => {
    const doc = new RegistrationCounter({ church: 3 });

    assert.equal(doc.validateSync(), undefined);
  });

  it("vaut 0 par défaut pour `lastNumber`", () => {
    const doc = new RegistrationCounter({ church: 3 });

    assert.equal(doc.lastNumber, 0);
  });
});

describe("RegistrationCounter (modèle) — persistance (intégration MongoDB)", () => {
  before(async () => {
    await connectTestDb();
    // S'assure que l'index unique est construit avant le test qui en
    // dépend (le build d'index est asynchrone après la connexion).
    await RegistrationCounter.init();
  });

  beforeEach(async () => {
    await RegistrationCounter.deleteOne({ church: TEST_CHURCH });
  });

  after(async () => {
    await RegistrationCounter.deleteOne({ church: TEST_CHURCH });
    await disconnectTestDb();
  });

  it("s'incrémente atomiquement via $inc, avec upsert au premier appel", async () => {
    const counter = await RegistrationCounter.findOneAndUpdate(
      { church: TEST_CHURCH },
      { $inc: { lastNumber: 1 } },
      { new: true, upsert: true }
    );

    assert.equal(counter.lastNumber, 1);

    const again = await RegistrationCounter.findOneAndUpdate(
      { church: TEST_CHURCH },
      { $inc: { lastNumber: 1 } },
      { new: true, upsert: true }
    );

    assert.equal(again.lastNumber, 2);
  });

  it("l'index unique sur `church` rejette un doublon inséré directement", async () => {
    // Insertion directe sur la collection (contourne les validateurs
    // Mongoose, comme le fait l'upsert de production) : c'est l'index
    // MongoDB lui-même qui doit refuser le doublon.
    await RegistrationCounter.collection.insertOne({
      church: TEST_CHURCH,
      lastNumber: 0,
    });

    await assert.rejects(
      RegistrationCounter.collection.insertOne({
        church: TEST_CHURCH,
        lastNumber: 0,
      }),
      (error) => error.code === 11000
    );
  });
});
