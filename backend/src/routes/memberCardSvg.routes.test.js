import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import { signToken } from "../middlewares/auth.js";
import User from "../models/User.js";
import Member from "../models/Member.js";
import Flock from "../models/Flock.js";

// Gabarits de test tant que public/cards/*.svg n'ont pas encore le
// contrat d'id (voir memberCardSvg.service.js) — DOIT être posé avant
// la première requête HTTP qui déclenche une génération de carte, pas
// forcément avant l'import de l'app (résolution paresseuse des
// chemins côté service).
const FIXTURES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../test/fixtures/memberCard"
);

process.env.MEMBER_CARD_RECTO_PATH_OVERRIDE = path.join(
  FIXTURES_DIR,
  "recto.svg"
);
process.env.MEMBER_CARD_VERSO_PATH_OVERRIDE = path.join(
  FIXTURES_DIR,
  "verso.svg"
);

const { createApp } = await import("../app.js");

// Tests d'intégration HTTP des routes de carte de membre
// (GET /api/admin/members/:id/card.pdf, /card.jpg, /card-verso.jpg),
// sur le même modèle que submissions.routes.test.js : vraie app
// Express sur un port éphémère, jeton minté directement via
// signToken().
//
// Isolation : nom de famille improbable en production, code de
// bergerie distinct des autres suites ("XS" — memberCardSvg.service.
// test utilise déjà "XD", l'ancien memberCard.routes.test "XR").
const TEST_LAST_NAME = "TestSuiteCardSvgRoutes";
const FLOCK_CODE = "XS";
const EDITOR_EMAIL = "editor.testsuite.cardsvgroutes@example.invalid";

let server;
let baseUrl;
let adminToken;
let editorToken;
let editorUserId;
let testFlock;
let memberWithCard;
let memberWithoutCard;
let memberInactive;

describe("Routes de carte de membre SVG (intégration HTTP)", () => {
  before(async () => {
    await connectTestDb();
    await Promise.all([Flock.init(), Member.init()]);

    const adminUser = await User.findOne({ role: "admin" }).lean();
    assert.ok(
      adminUser,
      "Un utilisateur admin doit exister en base pour ce test."
    );
    adminToken = signToken({ _id: adminUser._id, role: "admin" });

    const editorUser = await User.create({
      name: "Éditeur Test Suite Carte SVG",
      email: EDITOR_EMAIL,
      password: "MotDePasseTemporaire123!",
      role: "editor",
    });
    editorUserId = editorUser._id;
    editorToken = signToken({ _id: editorUser._id, role: "editor" });

    testFlock = await Flock.create({
      code: FLOCK_CODE,
      name: "Bergerie Test Carte SVG Routes",
      church: 1,
    });

    memberWithCard = await Member.create({
      firstName: "jean-baptiste",
      lastName: TEST_LAST_NAME,
      church: 1,
      flock: testFlock._id,
      registrationNumber: "1XS26007G",
      joinedAt: new Date(2021, 0, 1),
    });

    memberWithoutCard = await Member.create({
      firstName: "SansMatricule",
      lastName: TEST_LAST_NAME,
      church: 1,
      flock: testFlock._id,
    });

    memberInactive = await Member.create({
      firstName: "Desactive",
      lastName: TEST_LAST_NAME,
      church: 1,
      flock: testFlock._id,
      registrationNumber: "1XS26008H",
      joinedAt: new Date(2021, 0, 1),
      status: "inactif",
    });

    const app = createApp();
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await Member.deleteMany({ lastName: TEST_LAST_NAME });
    await Flock.deleteOne({ code: FLOCK_CODE, church: 1 });
    await User.deleteOne({ _id: editorUserId });
    await new Promise((resolve) => server.close(resolve));
    await disconnectTestDb();
  });

  for (const suffix of ["card.pdf", "card.jpg", "card-verso.jpg"]) {
    it(`GET /api/admin/members/:id/${suffix} exige une authentification (401 sans jeton)`, async () => {
      const res = await fetch(
        `${baseUrl}/api/admin/members/${memberWithCard._id}/${suffix}`
      );
      assert.equal(res.status, 401);
    });

    it(`GET /api/admin/members/:id/${suffix} refuse un compte non-admin (403)`, async () => {
      const res = await fetch(
        `${baseUrl}/api/admin/members/${memberWithCard._id}/${suffix}`,
        { headers: { Authorization: `Bearer ${editorToken}` } }
      );
      assert.equal(res.status, 403);
    });
  }

  it("GET /api/admin/members/:id/card.pdf renvoie un PDF recto+verso pour un administrateur", async () => {
    const res = await fetch(
      `${baseUrl}/api/admin/members/${memberWithCard._id}/card.pdf`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "application/pdf");

    const buffer = Buffer.from(await res.arrayBuffer());
    assert.equal(buffer.subarray(0, 5).toString("latin1"), "%PDF-");
  });

  it("GET /api/admin/members/:id/card.jpg renvoie la carte numérique (recto) pour un administrateur", async () => {
    const res = await fetch(
      `${baseUrl}/api/admin/members/${memberWithCard._id}/card.jpg`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "image/jpeg");

    const buffer = Buffer.from(await res.arrayBuffer());
    assert.equal(buffer.subarray(0, 2).toString("hex"), "ffd8");
  });

  it("GET /api/admin/members/:id/card-verso.jpg renvoie le verso pour un administrateur", async () => {
    const res = await fetch(
      `${baseUrl}/api/admin/members/${memberWithCard._id}/card-verso.jpg`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "image/jpeg");

    const buffer = Buffer.from(await res.arrayBuffer());
    assert.equal(buffer.subarray(0, 2).toString("hex"), "ffd8");
  });

  it("GET /api/admin/members/:id/card.jpg renvoie 422 pour un membre sans matricule", async () => {
    const res = await fetch(
      `${baseUrl}/api/admin/members/${memberWithoutCard._id}/card.jpg`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert.equal(res.status, 422);
  });

  for (const suffix of ["card.pdf", "card.jpg", "card-verso.jpg"]) {
    it(`GET /api/admin/members/:id/${suffix} renvoie 403 pour un membre désactivé`, async () => {
      const res = await fetch(
        `${baseUrl}/api/admin/members/${memberInactive._id}/${suffix}`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      assert.equal(res.status, 403);
    });
  }
});
