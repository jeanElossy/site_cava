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

  it("generate() refuse une durée absente ou invalide", async () => {
    await assert.rejects(
      presenceQrService.generate({ label: LABEL, durationMinutes: 0 }),
      (error) => error.status === 400
    );

    await assert.rejects(
      presenceQrService.generate({ label: LABEL, durationMinutes: "pas un nombre" }),
      (error) => error.status === 400
    );
  });

  it("generate() crée un QR « en attente » — actif comme statut de base, mais jamais activé", async () => {
    const qr = await presenceQrService.generate({
      label: LABEL,
      durationMinutes: 240,
    });

    assert.equal(qr.status, "active");
    assert.equal(qr.computedStatus, "pending");
    assert.equal(qr.activatedAt, null);
    assert.equal(qr.validFrom, null);
    assert.equal(qr.validUntil, null);
    assert.equal(qr.durationMinutes, 240);
  });

  it("computeStatus() : en_attente tant que non scanné, puis actif/expiré selon activation+durée, jamais du champ status seul", () => {
    const now = new Date("2026-08-09T09:00:00.000Z");

    assert.equal(
      presenceQrService.computeStatus(
        { status: "active", activatedAt: null, durationMinutes: 60 },
        now
      ),
      "pending"
    );

    assert.equal(
      presenceQrService.computeStatus(
        {
          status: "active",
          activatedAt: new Date("2026-08-09T08:30:00Z"),
          durationMinutes: 60,
        },
        now
      ),
      "active"
    );

    assert.equal(
      presenceQrService.computeStatus(
        {
          status: "active",
          activatedAt: new Date("2026-08-09T07:00:00Z"),
          durationMinutes: 60,
        },
        now
      ),
      "expired"
    );

    assert.equal(
      presenceQrService.computeStatus(
        {
          status: "revoked",
          activatedAt: new Date("2026-08-09T07:00:00Z"),
          durationMinutes: 60,
        },
        now
      ),
      "revoked"
    );
  });

  it("verifyToken() active un QR jamais scanné à son tout premier scan réussi, et accepte les scans suivants dans la fenêtre", async () => {
    const created = await presenceQrService.generate({
      label: LABEL,
      durationMinutes: 60,
    });

    const doc = await PresenceSecurityQr.findById(created.id);
    const token = signPresenceQrToken(doc);

    assert.equal(doc.activatedAt, null);

    const first = await presenceQrService.verifyToken(token);

    assert.equal(first.ok, true);
    assert.equal(first.qr.label, LABEL);
    assert.ok(first.qr.activatedAt, "activatedAt doit être posé au premier scan");

    const activatedAt = first.qr.activatedAt.getTime();

    const second = await presenceQrService.verifyToken(token);

    assert.equal(second.ok, true);
    assert.equal(
      second.qr.activatedAt.getTime(),
      activatedAt,
      "un second scan ne doit jamais déplacer activatedAt"
    );
  });

  it("verifyToken() n'active PAS et refuse un QR pas encore activable (notBefore dans le futur)", async () => {
    const created = await presenceQrService.generate({
      label: LABEL,
      durationMinutes: 60,
      notBefore: new Date(Date.now() + 60 * 60_000),
    });

    const doc = await PresenceSecurityQr.findById(created.id);
    const token = signPresenceQrToken(doc);

    const result = await presenceQrService.verifyToken(token);

    assert.equal(result.ok, false);
    assert.equal(result.reason, "pas_encore_valide");

    const reloaded = await PresenceSecurityQr.findById(created.id);
    assert.equal(
      reloaded.activatedAt,
      null,
      "un scan refusé (trop tôt) ne doit jamais activer le QR"
    );
  });

  it("verifyToken() accepte un QR dont le notBefore est déjà passé", async () => {
    const created = await presenceQrService.generate({
      label: LABEL,
      durationMinutes: 60,
      notBefore: new Date(Date.now() - 60_000),
    });

    const doc = await PresenceSecurityQr.findById(created.id);
    const token = signPresenceQrToken(doc);

    const result = await presenceQrService.verifyToken(token);

    assert.equal(result.ok, true);
  });

  it("verifyToken() refuse un QR expiré (activé il y a plus longtemps que sa durée)", async () => {
    const created = await presenceQrService.generate({
      label: LABEL,
      durationMinutes: 30,
    });

    await PresenceSecurityQr.updateOne(
      { _id: created.id },
      { activatedAt: new Date(Date.now() - 60 * 60_000) }
    );

    const doc = await PresenceSecurityQr.findById(created.id);
    const token = signPresenceQrToken(doc);

    const result = await presenceQrService.verifyToken(token);

    assert.equal(result.ok, false);
    assert.equal(result.reason, "expire");
  });

  it("verifyToken() refuse un QR révoqué même en pleine fenêtre — la révocation est immédiate", async () => {
    const created = await presenceQrService.generate({
      label: LABEL,
      durationMinutes: 60,
    });

    const doc = await PresenceSecurityQr.findById(created.id);
    const token = signPresenceQrToken(doc);

    await presenceQrService.revoke(created.id);

    const result = await presenceQrService.verifyToken(token);

    assert.equal(result.ok, false);
    assert.equal(result.reason, "revoque");
  });

  it("verifyToken() ne réactive pas un QR révoqué après activation : la révocation gèle son état", async () => {
    const created = await presenceQrService.generate({
      label: LABEL,
      durationMinutes: 60,
    });

    const doc = await PresenceSecurityQr.findById(created.id);
    const token = signPresenceQrToken(doc);

    await presenceQrService.verifyToken(token);
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

  it("getImage() renvoie une image QR encodée en data URL, même pour un QR encore en attente", async () => {
    const created = await presenceQrService.generate({
      label: LABEL,
      durationMinutes: 60,
    });

    const dataUrl = await presenceQrService.getImage(created.id);

    assert.match(dataUrl, /^data:image\/png;base64,/);
  });

  it("history() est vide pour un QR jamais utilisé", async () => {
    const created = await presenceQrService.generate({
      label: LABEL,
      durationMinutes: 60,
    });

    const entries = await presenceQrService.history(created.id);

    assert.deepEqual(entries, []);
  });
});
