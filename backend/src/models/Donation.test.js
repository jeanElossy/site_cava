import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import Donation from "./Donation.js";

const TEST_PHONE = "0700000099";

const cleanup = () => Donation.deleteMany({ "donor.phone": TEST_PHONE });

const validPayload = () => ({
  donor: {
    firstName: "Jean",
    lastName: "Kouassi",
    phone: TEST_PHONE,
    email: "jean@example.invalid",
  },
  amount: 5000,
  donationType: { name: "Dîme" },
  paymentMethod: { name: "Orange Money" },
  proof: { transactionId: "MP240101.1234.A12345" },
});

describe("Donation (modèle)", () => {
  before(async () => {
    await connectTestDb();
  });

  beforeEach(cleanup);
  after(async () => {
    await cleanup();
    await disconnectTestDb();
  });

  it("crée un don avec le statut « en_attente » par défaut", async () => {
    const donation = await Donation.create(validPayload());

    assert.equal(donation.status, "en_attente");
    assert.equal(donation.currency, "XOF");
    assert.match(donation.reference, /^CAVA-[0-9A-F]{16}$/);
  });

  it("exige le numéro de transaction", async () => {
    const payload = validPayload();
    delete payload.proof.transactionId;

    await assert.rejects(Donation.create(payload));
  });

  it("exige le téléphone du donateur", async () => {
    const payload = validPayload();
    delete payload.donor.phone;

    await assert.rejects(Donation.create(payload));
  });

  it("rejette un montant en dessous du minimum", async () => {
    await assert.rejects(
      Donation.create({ ...validPayload(), amount: 100 })
    );
  });

  it("n'expose pas providerPayload en JSON (champ hérité retiré du schéma)", async () => {
    const donation = await Donation.create(validPayload());

    assert.equal(donation.toJSON().providerPayload, undefined);
  });
});
