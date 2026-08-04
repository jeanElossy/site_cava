import { describe, it } from "node:test";
import assert from "node:assert/strict";

import PresenceSecurityQr from "./PresenceSecurityQr.js";

describe("PresenceSecurityQr (modèle) — validation du schéma (sans base)", () => {
  it("exige label, validFrom et validUntil", () => {
    const doc = new PresenceSecurityQr({});
    const error = doc.validateSync();

    assert.ok(error.errors.label);
    assert.ok(error.errors.validFrom);
    assert.ok(error.errors.validUntil);
  });

  it("refuse une fin de validité antérieure ou égale au début", () => {
    const sameInstant = new Date("2026-08-09T07:30:00.000Z");

    const equal = new PresenceSecurityQr({
      label: "Culte du dimanche 8h30",
      validFrom: sameInstant,
      validUntil: sameInstant,
    });

    const before = new PresenceSecurityQr({
      label: "Culte du dimanche 8h30",
      validFrom: sameInstant,
      validUntil: new Date(sameInstant.getTime() - 1000),
    });

    assert.ok(equal.validateSync().errors.validUntil);
    assert.ok(before.validateSync().errors.validUntil);
  });

  it("accepte une fenêtre valide et génère un jti unique par défaut", () => {
    const doc = new PresenceSecurityQr({
      label: "Culte du dimanche 8h30",
      validFrom: new Date("2026-08-09T07:30:00.000Z"),
      validUntil: new Date("2026-08-09T12:30:00.000Z"),
    });

    assert.equal(doc.validateSync(), undefined);
    assert.equal(typeof doc.jti, "string");
    assert.ok(doc.jti.length >= 32);
    assert.equal(doc.status, "active");
  });
});
