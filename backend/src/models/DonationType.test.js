import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import DonationType from "./DonationType.js";

const TEST_NAME = "Type de test ZZ";

const cleanup = () => DonationType.deleteMany({ name: TEST_NAME });

describe("DonationType (modèle)", () => {
  before(async () => {
    await connectTestDb();
  });

  beforeEach(cleanup);
  after(async () => {
    await cleanup();
    await disconnectTestDb();
  });

  it("crée un type de don actif par défaut", async () => {
    const type = await DonationType.create({ name: TEST_NAME });

    assert.equal(type.active, true);
    assert.equal(type.order, 0);
  });

  it("exige un nom", async () => {
    await assert.rejects(DonationType.create({ description: "sans nom" }));
  });
});
