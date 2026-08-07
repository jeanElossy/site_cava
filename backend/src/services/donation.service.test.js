import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import Donation from "../models/Donation.js";
import PaymentMethod from "../models/PaymentMethod.js";
import DonationType from "../models/DonationType.js";
import User from "../models/User.js";
import * as donationService from "./donation.service.js";

const TEST_PHONE = "0700000098";

let method;
let type;
let admin;

const cleanup = async () => {
  await Donation.deleteMany({ "donor.phone": TEST_PHONE });
};

const basePayload = () => ({
  donor: {
    firstName: "Awa",
    lastName: "Traoré",
    phone: TEST_PHONE,
    email: "",
  },
  amount: 15000,
  donationTypeId: String(type._id),
  paymentMethodId: String(method._id),
  proof: { transactionId: "MP240101.9999.B54321" },
});

describe("donation.service (intégration MongoDB)", () => {
  before(async () => {
    await connectTestDb();

    method = await PaymentMethod.create({
      name: "Orange Money Test",
      accountNumber: "0700000000",
      holderName: "CAVA",
      active: true,
    });

    type = await DonationType.create({ name: "Dîme Test", active: true });

    admin = await User.findOne({ role: "admin" });

    if (!admin) {
      admin = await User.create({
        name: "Admin Test Dons",
        email: "admin.donation.testsuite@example.invalid",
        password: "MotDePasseTemporaire123!",
        role: "admin",
      });
    }
  });

  beforeEach(cleanup);
  after(async () => {
    await cleanup();
    await PaymentMethod.deleteOne({ _id: method._id });
    await DonationType.deleteOne({ _id: type._id });
    await disconnectTestDb();
  });

  it("crée un don en attente avec le libellé du type et du moyen figé", async () => {
    const result = await donationService.createDonation(basePayload(), {
      ip: "127.0.0.1",
    });

    assert.equal(result.status, "en_attente");
    assert.match(result.reference, /^CAVA-/);

    const stored = await Donation.findOne({ reference: result.reference });

    assert.equal(stored.donationType.name, "Dîme Test");
    assert.equal(stored.paymentMethod.name, "Orange Money Test");
  });

  it("refuse un don sans numéro de transaction", async () => {
    const payload = basePayload();
    delete payload.proof.transactionId;

    await assert.rejects(() => donationService.createDonation(payload, {}));
  });

  it("refuse un moyen de paiement inactif", async () => {
    const inactive = await PaymentMethod.create({
      name: "Moyen inactif test",
      active: false,
    });

    await assert.rejects(() =>
      donationService.createDonation(
        { ...basePayload(), paymentMethodId: String(inactive._id) },
        {}
      )
    );

    await PaymentMethod.deleteOne({ _id: inactive._id });
  });

  // Régression : Mongoose retire d'un filtre les clés valant
  // `undefined`. `findOne({ _id: undefined, active: true })` devenait
  // donc `findOne({ active: true })`, qui renvoie le PREMIER type (ou
  // moyen) actif venu — un don sans `donationTypeId` était accepté et
  // se voyait attribuer un type arbitraire, en silence.
  it("refuse un don sans identifiant de type de don", async () => {
    const payload = basePayload();
    delete payload.donationTypeId;

    await assert.rejects(() => donationService.createDonation(payload, {}), {
      message: "Type de don invalide.",
    });
  });

  it("refuse un don sans identifiant de moyen de paiement", async () => {
    const payload = basePayload();
    delete payload.paymentMethodId;

    await assert.rejects(() => donationService.createDonation(payload, {}), {
      message: "Moyen de paiement invalide.",
    });
  });

  // Le cas réellement exploitable du même défaut : un corps JSON peut
  // porter un OPÉRATEUR Mongo à la place d'un identifiant.
  // `findOne({ _id: { $ne: null }, active: true })` renvoyait le
  // premier type actif venu — un don au type arbitraire, accepté sans
  // que rien ne le signale.
  it("refuse un opérateur Mongo à la place d'un identifiant", async () => {
    await assert.rejects(() =>
      donationService.createDonation(
        { ...basePayload(), donationTypeId: { $ne: null } },
        {}
      )
    );

    await assert.rejects(() =>
      donationService.createDonation(
        { ...basePayload(), paymentMethodId: { $ne: null } },
        {}
      )
    );

    assert.equal(
      await Donation.countDocuments({ "donor.phone": TEST_PHONE }),
      0
    );
  });

  it("refuse un identifiant de type de don qui n'est pas un ObjectId", async () => {
    await assert.rejects(() =>
      donationService.createDonation(
        { ...basePayload(), donationTypeId: "pas-un-objectid" },
        {}
      )
    );
  });

  it("n'enregistre aucun don quand le type est absent", async () => {
    const payload = basePayload();
    delete payload.donationTypeId;

    await assert.rejects(() => donationService.createDonation(payload, {}));

    const stored = await Donation.countDocuments({ "donor.phone": TEST_PHONE });

    assert.equal(stored, 0);
  });

  it("signale un numéro de transaction déclaré sur plusieurs dons", async () => {
    await donationService.createDonation(basePayload(), {});
    await donationService.createDonation(basePayload(), {});

    const { items } = await donationService.adminList({ limit: 100 });

    const mine = items.filter((item) => item.donor?.phone === TEST_PHONE);

    assert.equal(mine.length, 2);

    for (const item of mine) {
      assert.ok(
        item.duplicateTransactionCount >= 1,
        "le doublon de numéro de transaction doit être signalé"
      );
    }
  });

  it("valide un don en attente et enregistre qui a décidé", async () => {
    const created = await donationService.createDonation(basePayload(), {});
    const stored = await Donation.findOne({ reference: created.reference });

    const reviewed = await donationService.review(
      stored._id,
      { decision: "valide" },
      admin
    );

    assert.equal(reviewed.status, "valide");
    assert.equal(String(reviewed.reviewedBy), String(admin._id));
    assert.ok(reviewed.reviewedAt);
  });

  it("exige une remarque pour rejeter un don", async () => {
    const created = await donationService.createDonation(basePayload(), {});
    const stored = await Donation.findOne({ reference: created.reference });

    await assert.rejects(() =>
      donationService.review(stored._id, { decision: "rejete" }, admin)
    );
  });

  it("refuse de re-décider un don déjà tranché", async () => {
    const created = await donationService.createDonation(basePayload(), {});
    const stored = await Donation.findOne({ reference: created.reference });

    await donationService.review(stored._id, { decision: "valide" }, admin);

    await assert.rejects(() =>
      donationService.review(
        stored._id,
        { decision: "rejete", note: "trop tard" },
        admin
      )
    );
  });
});
