import { describe, it } from "node:test";
import assert from "node:assert/strict";

import PresenceSecurityQr from "./PresenceSecurityQr.js";

describe("PresenceSecurityQr (modèle) — validation du schéma (sans base)", () => {
  it("exige label et durationMinutes", () => {
    const doc = new PresenceSecurityQr({});
    const error = doc.validateSync();

    assert.ok(error.errors.label);
    assert.ok(error.errors.durationMinutes);
  });

  it("refuse une durée nulle, négative ou au-delà de 7 jours", () => {
    const tooShort = new PresenceSecurityQr({
      label: "Culte du dimanche 8h30",
      durationMinutes: 0,
    });

    const negative = new PresenceSecurityQr({
      label: "Culte du dimanche 8h30",
      durationMinutes: -30,
    });

    const tooLong = new PresenceSecurityQr({
      label: "Culte du dimanche 8h30",
      durationMinutes: 7 * 24 * 60 + 1,
    });

    assert.ok(tooShort.validateSync().errors.durationMinutes);
    assert.ok(negative.validateSync().errors.durationMinutes);
    assert.ok(tooLong.validateSync().errors.durationMinutes);
  });

  it("accepte une durée valide, sans notBefore ni activatedAt (en attente), et génère un jti unique par défaut", () => {
    const doc = new PresenceSecurityQr({
      label: "Culte du dimanche 8h30",
      durationMinutes: 240,
    });

    assert.equal(doc.validateSync(), undefined);
    assert.equal(typeof doc.jti, "string");
    assert.ok(doc.jti.length >= 32);
    assert.equal(doc.status, "active");
    assert.equal(doc.activatedAt, null);
    assert.equal(doc.notBefore, undefined);
  });

  it("accepte un notBefore et un activatedAt explicites", () => {
    const doc = new PresenceSecurityQr({
      label: "Culte du dimanche 8h30",
      durationMinutes: 240,
      notBefore: new Date("2026-08-09T07:00:00.000Z"),
      activatedAt: new Date("2026-08-09T07:30:00.000Z"),
    });

    assert.equal(doc.validateSync(), undefined);
  });
});
