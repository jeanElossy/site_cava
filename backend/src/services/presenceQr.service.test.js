import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import PresenceSecurityQr from "../models/PresenceSecurityQr.js";
import PresenceLogin from "../models/PresenceLogin.js";
import { signPresenceQrToken } from "../middlewares/presenceAuth.js";
import * as presenceQrService from "./presenceQr.service.js";

// Libellé improbable en production, pour isoler ce que ce fichier crée
// et le nettoyer sans risque de toucher un vrai QR de sécurité (même
// base que le développement — voir test/db.js).
const LABEL = "TestSuitePresenceQr";

const cleanup = async () => {
  const qrs = await PresenceSecurityQr.find({ label: LABEL }).select("_id");
  const ids = qrs.map((qr) => qr._id);

  await PresenceLogin.deleteMany({ securityQr: { $in: ids } });
  await PresenceSecurityQr.deleteMany({ label: LABEL });
};

describe("presenceQr.service (intégration MongoDB)", () => {
  before(async () => {
    await connectTestDb();
    await PresenceSecurityQr.init();
  });

  beforeEach(cleanup);
  after(async () => {
    await cleanup();
    await disconnectTestDb();
  });

  it("generate() refuse une fenêtre invalide (fin <= début)", async () => {
    const from = new Date("2026-08-09T07:30:00.000Z");

    await assert.rejects(
      presenceQrService.generate({
        label: LABEL,
        validFrom: from,
        validUntil: from,
      }),
      (error) => error.status === 400
    );
  });

  it("generate() crée un QR actif par défaut", async () => {
    const qr = await presenceQrService.generate({
      label: LABEL,
      validFrom: new Date(Date.now() - 60_000),
      validUntil: new Date(Date.now() + 60 * 60_000),
    });

    assert.equal(qr.status, "active");
    assert.equal(qr.computedStatus, "active");
  });

  it("computeStatus() dérive à_venir/actif/expiré de la fenêtre, jamais du champ status seul", () => {
    const now = new Date("2026-08-09T09:00:00.000Z");

    assert.equal(
      presenceQrService.computeStatus(
        { status: "active", validFrom: new Date("2026-08-09T10:00:00Z"), validUntil: new Date("2026-08-09T12:00:00Z") },
        now
      ),
      "upcoming"
    );

    assert.equal(
      presenceQrService.computeStatus(
        { status: "active", validFrom: new Date("2026-08-09T07:00:00Z"), validUntil: new Date("2026-08-09T12:00:00Z") },
        now
      ),
      "active"
    );

    assert.equal(
      presenceQrService.computeStatus(
        { status: "active", validFrom: new Date("2026-08-09T05:00:00Z"), validUntil: new Date("2026-08-09T08:00:00Z") },
        now
      ),
      "expired"
    );

    assert.equal(
      presenceQrService.computeStatus(
        { status: "revoked", validFrom: new Date("2026-08-09T05:00:00Z"), validUntil: new Date("2026-08-09T12:00:00Z") },
        now
      ),
      "revoked"
    );
  });

  it("verifyToken() accepte un QR actif dans sa fenêtre", async () => {
    const created = await presenceQrService.generate({
      label: LABEL,
      validFrom: new Date(Date.now() - 60_000),
      validUntil: new Date(Date.now() + 60 * 60_000),
    });

    const doc = await PresenceSecurityQr.findById(created.id);
    const token = signPresenceQrToken(doc);

    const result = await presenceQrService.verifyToken(token);

    assert.equal(result.ok, true);
    assert.equal(result.qr.label, LABEL);
  });

  it("verifyToken() refuse un QR expiré, même avec un jeton par ailleurs valide", async () => {
    const created = await presenceQrService.generate({
      label: LABEL,
      validFrom: new Date(Date.now() - 2 * 60 * 60_000),
      validUntil: new Date(Date.now() - 60 * 60_000),
    });

    const doc = await PresenceSecurityQr.findById(created.id);
    const token = signPresenceQrToken(doc);

    const result = await presenceQrService.verifyToken(token);

    assert.equal(result.ok, false);
    assert.equal(result.reason, "expire");
  });

  it("verifyToken() refuse un QR pas encore valide", async () => {
    const created = await presenceQrService.generate({
      label: LABEL,
      validFrom: new Date(Date.now() + 60 * 60_000),
      validUntil: new Date(Date.now() + 2 * 60 * 60_000),
    });

    const doc = await PresenceSecurityQr.findById(created.id);
    const token = signPresenceQrToken(doc);

    const result = await presenceQrService.verifyToken(token);

    assert.equal(result.ok, false);
    assert.equal(result.reason, "pas_encore_valide");
  });

  it("verifyToken() refuse un QR révoqué même en pleine fenêtre horaire — la révocation est immédiate", async () => {
    const created = await presenceQrService.generate({
      label: LABEL,
      validFrom: new Date(Date.now() - 60_000),
      validUntil: new Date(Date.now() + 60 * 60_000),
    });

    const doc = await PresenceSecurityQr.findById(created.id);
    const token = signPresenceQrToken(doc);

    await presenceQrService.revoke(created.id);

    const result = await presenceQrService.verifyToken(token);

    assert.equal(result.ok, false);
    assert.equal(result.reason, "revoque");
  });

  it("verifyToken() refuse un jeton falsifié ou d'une autre portée", async () => {
    const result = await presenceQrService.verifyToken("pas-un-jeton");

    assert.equal(result.ok, false);
    assert.equal(result.reason, "invalide");
  });

  it("getImage() renvoie une image QR encodée en data URL", async () => {
    const created = await presenceQrService.generate({
      label: LABEL,
      validFrom: new Date(Date.now() - 60_000),
      validUntil: new Date(Date.now() + 60 * 60_000),
    });

    const dataUrl = await presenceQrService.getImage(created.id);

    assert.match(dataUrl, /^data:image\/png;base64,/);
  });

  it("history() est vide pour un QR jamais utilisé", async () => {
    const created = await presenceQrService.generate({
      label: LABEL,
      validFrom: new Date(Date.now() - 60_000),
      validUntil: new Date(Date.now() + 60 * 60_000),
    });

    const entries = await presenceQrService.history(created.id);

    assert.deepEqual(entries, []);
  });
});
