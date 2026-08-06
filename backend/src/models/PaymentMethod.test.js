import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import PaymentMethod from "./PaymentMethod.js";

const TEST_NAME = "Moyen de test ZZ";

const cleanup = () => PaymentMethod.deleteMany({ name: TEST_NAME });

describe("PaymentMethod (modèle)", () => {
  before(async () => {
    await connectTestDb();
  });

  beforeEach(cleanup);
  after(async () => {
    await cleanup();
    await disconnectTestDb();
  });

  it("crée un moyen de paiement avec les valeurs par défaut", async () => {
    const method = await PaymentMethod.create({
      name: TEST_NAME,
      accountNumber: "0700000000",
      holderName: "CAVA",
    });

    assert.equal(method.active, false);
    assert.equal(method.order, 0);
    assert.equal(method.image.url, undefined);
  });

  it("exige un nom", async () => {
    await assert.rejects(
      PaymentMethod.create({ accountNumber: "0700000000", holderName: "CAVA" })
    );
  });

  it("accepte une image Cloudinary", async () => {
    const method = await PaymentMethod.create({
      name: TEST_NAME,
      accountNumber: "0700000000",
      holderName: "CAVA",
      image: { url: "https://res.cloudinary.com/x/y.png", publicId: "cava/dons/x" },
      active: true,
      order: 2,
    });

    assert.equal(method.image.url, "https://res.cloudinary.com/x/y.png");
    assert.equal(method.active, true);
    assert.equal(method.order, 2);
  });
});
