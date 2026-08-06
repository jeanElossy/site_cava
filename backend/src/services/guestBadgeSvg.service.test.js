import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildGuestBadgeJpeg, buildGuestBadgesPdf } from "./guestBadgeSvg.service.js";

describe("guestBadgeSvg.service", () => {
  it("génère un badge JPEG valide pour un genre et un index connus", async () => {
    const buffer = await buildGuestBadgeJpeg("HOMME", 1);

    assert.ok(Buffer.isBuffer(buffer));
    // Marqueur JPEG (SOI).
    assert.equal(buffer.subarray(0, 2).toString("hex"), "ffd8");
  });

  it("accepte le genre en minuscule (insensible à la casse)", async () => {
    const buffer = await buildGuestBadgeJpeg("femme", 5);

    assert.ok(Buffer.isBuffer(buffer));
  });

  it("refuse un genre ou un index inconnu", async () => {
    await assert.rejects(() => buildGuestBadgeJpeg("AUTRE", 1));
    await assert.rejects(() => buildGuestBadgeJpeg("HOMME", 6));
    await assert.rejects(() => buildGuestBadgeJpeg("HOMME", 0));
  });

  it("génère un PDF de 5 pages pour le genre homme", async () => {
    const buffer = await buildGuestBadgesPdf("HOMME");

    assert.ok(Buffer.isBuffer(buffer));
    assert.equal(buffer.subarray(0, 5).toString("latin1"), "%PDF-");

    const pageCount = (
      buffer.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []
    ).length;
    assert.equal(pageCount, 5);
  });

  it("génère un PDF de 5 pages pour le genre femme, insensible à la casse", async () => {
    const buffer = await buildGuestBadgesPdf("femme");

    assert.ok(Buffer.isBuffer(buffer));

    const pageCount = (
      buffer.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []
    ).length;
    assert.equal(pageCount, 5);
  });

  it("refuse un genre absent ou inconnu", async () => {
    await assert.rejects(() => buildGuestBadgesPdf(), /Genre .* inconnu/);
    await assert.rejects(() => buildGuestBadgesPdf("AUTRE"), /Genre .* inconnu/);
  });
});
