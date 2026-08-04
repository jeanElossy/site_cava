import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import Flock from "../models/Flock.js";
import Member from "../models/Member.js";
import { buildMemberCardPdf, buildMemberCardJpeg } from "./memberCard.service.js";

// Même logo que celui affiché sur la carte : un fichier local existant,
// suffisant pour vérifier le chemin de code "photo réelle" sans
// dépendre d'un service externe.
const LOCAL_TEST_IMAGE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../assets/logo-cava.png"
);

// Isolation : nom de famille improbable en production, code de
// bergerie distinct des autres suites de tests ("ZZ"/"YY"/"XM").
const TEST_LAST_NAME = "TestSuiteCard";
const FLOCK_CODE = "XC";

let testFlock;

const cleanupMembers = async () =>
  Member.deleteMany({ lastName: TEST_LAST_NAME });

describe("memberCard.service (intégration MongoDB)", () => {
  before(async () => {
    await connectTestDb();
    await Promise.all([Flock.init(), Member.init()]);

    testFlock = await Flock.create({
      code: FLOCK_CODE,
      name: "Bergerie Test Carte",
      church: 1,
    });
  });

  beforeEach(cleanupMembers);
  afterEach(cleanupMembers);

  after(async () => {
    await cleanupMembers();
    await Flock.deleteOne({ code: FLOCK_CODE, church: 1 });
    await disconnectTestDb();
  });

  it("génère une carte PDF valide pour un membre avec matricule", async () => {
    const member = await Member.create({
      firstName: "jean-baptiste",
      lastName: TEST_LAST_NAME,
      church: 1,
      flock: testFlock._id,
      registrationNumber: "1XC26007G",
      joinedAt: new Date(2021, 0, 1),
    });

    const buffer = await buildMemberCardPdf(member._id);

    assert.ok(Buffer.isBuffer(buffer));
    assert.equal(buffer.subarray(0, 5).toString("latin1"), "%PDF-");
  });

  it("lève une 404 pour un membre introuvable", async () => {
    await assert.rejects(
      buildMemberCardPdf(new mongoose.Types.ObjectId()),
      (error) => error.status === 404
    );
  });

  it("lève une 422 pour un membre sans matricule (aucune carte ne peut être émise)", async () => {
    const member = await Member.create({
      firstName: "SansMatricule",
      lastName: TEST_LAST_NAME,
      church: 1,
      flock: testFlock._id,
    });

    await assert.rejects(
      buildMemberCardPdf(member._id),
      (error) => error.status === 422
    );
  });

  it("génère une carte JPEG valide pour un membre avec matricule", async () => {
    const member = await Member.create({
      firstName: "jean-baptiste",
      lastName: TEST_LAST_NAME,
      church: 1,
      flock: testFlock._id,
      registrationNumber: "1XC26007G",
      joinedAt: new Date(2021, 0, 1),
    });

    const buffer = await buildMemberCardJpeg(member._id);

    assert.ok(Buffer.isBuffer(buffer));
    // Magic bytes JPEG (SOI marker) : 0xFF 0xD8.
    assert.equal(buffer.subarray(0, 2).toString("hex"), "ffd8");
  });

  it("lève une 404 pour un membre introuvable (JPEG)", async () => {
    await assert.rejects(
      buildMemberCardJpeg(new mongoose.Types.ObjectId()),
      (error) => error.status === 404
    );
  });

  it("lève une 422 pour un membre sans matricule (JPEG)", async () => {
    const member = await Member.create({
      firstName: "SansMatriculeJpeg",
      lastName: TEST_LAST_NAME,
      church: 1,
      flock: testFlock._id,
    });

    await assert.rejects(
      buildMemberCardJpeg(member._id),
      (error) => error.status === 422
    );
  });

  it("utilise la vraie photo du membre quand elle est renseignée, plutôt que les initiales", async () => {
    const member = await Member.create({
      firstName: "AvecPhoto",
      lastName: TEST_LAST_NAME,
      church: 1,
      flock: testFlock._id,
      registrationNumber: "1XC26008H",
      photo: LOCAL_TEST_IMAGE,
    });

    const buffer = await buildMemberCardPdf(member._id);

    assert.ok(Buffer.isBuffer(buffer));
    assert.equal(buffer.subarray(0, 5).toString("latin1"), "%PDF-");
  });

  it("revient aux initiales si l'URL de la photo est inaccessible, sans faire échouer la carte", async () => {
    const member = await Member.create({
      firstName: "PhotoCassee",
      lastName: TEST_LAST_NAME,
      church: 1,
      flock: testFlock._id,
      registrationNumber: "1XC26009I",
      // .invalid est un domaine réservé (RFC 2606), garanti de ne
      // jamais résoudre — teste le repli sans dépendre d'un vrai hôte
      // injoignable dont la lenteur varierait.
      photo: "https://exemple.invalid/introuvable.jpg",
    });

    const buffer = await buildMemberCardJpeg(member._id);

    assert.ok(Buffer.isBuffer(buffer));
    assert.equal(buffer.subarray(0, 2).toString("hex"), "ffd8");
  });
});
