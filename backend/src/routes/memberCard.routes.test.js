import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import { createApp } from "../app.js";
import { signToken } from "../middlewares/auth.js";
import User from "../models/User.js";
import Member from "../models/Member.js";
import Flock from "../models/Flock.js";

// Tests d'intégration HTTP des routes de carte de membre
// (GET /api/admin/members/:id/card.pdf et /:id/card.jpg), sur le même
// modèle que submissions.routes.test.js : vraie app Express sur un
// port éphémère, jeton minté directement via signToken().
//
// Isolation : nom de famille improbable en production, code de
// bergerie distinct des autres suites ("XR" — memberCard.service.test
// utilise déjà "XC").
const TEST_LAST_NAME = "TestSuiteCardRoutes";
const FLOCK_CODE = "XR";
const EDITOR_EMAIL = "editor.testsuite.cardroutes@example.invalid";

let server;
let baseUrl;
let adminToken;
let editorToken;
let editorUserId;
let testFlock;
let memberWithCard;
let memberWithoutCard;

describe("Routes de carte de membre (intégration HTTP)", () => {
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
      name: "Éditeur Test Suite Carte",
      email: EDITOR_EMAIL,
      password: "MotDePasseTemporaire123!",
      role: "editor",
    });
    editorUserId = editorUser._id;
    editorToken = signToken({ _id: editorUser._id, role: "editor" });

    testFlock = await Flock.create({
      code: FLOCK_CODE,
      name: "Bergerie Test Carte Routes",
      church: 1,
    });

    memberWithCard = await Member.create({
      firstName: "jean-baptiste",
      lastName: TEST_LAST_NAME,
      church: 1,
      flock: testFlock._id,
      registrationNumber: "1XR26007G",
      joinedAt: new Date(2021, 0, 1),
    });

    memberWithoutCard = await Member.create({
      firstName: "SansMatricule",
      lastName: TEST_LAST_NAME,
      church: 1,
      flock: testFlock._id,
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

  it("GET /api/admin/members/:id/card.pdf exige une authentification (401 sans jeton)", async () => {
    const res = await fetch(
      `${baseUrl}/api/admin/members/${memberWithCard._id}/card.pdf`
    );
    assert.equal(res.status, 401);
  });

  it("GET /api/admin/members/:id/card.jpg exige une authentification (401 sans jeton)", async () => {
    const res = await fetch(
      `${baseUrl}/api/admin/members/${memberWithCard._id}/card.jpg`
    );
    assert.equal(res.status, 401);
  });

  it("GET /api/admin/members/:id/card.pdf refuse un compte non-admin (403)", async () => {
    const res = await fetch(
      `${baseUrl}/api/admin/members/${memberWithCard._id}/card.pdf`,
      { headers: { Authorization: `Bearer ${editorToken}` } }
    );
    assert.equal(res.status, 403);
  });

  it("GET /api/admin/members/:id/card.pdf renvoie un PDF pour un administrateur", async () => {
    const res = await fetch(
      `${baseUrl}/api/admin/members/${memberWithCard._id}/card.pdf`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "application/pdf");

    const buffer = Buffer.from(await res.arrayBuffer());
    assert.equal(buffer.subarray(0, 5).toString("latin1"), "%PDF-");
  });

  it("GET /api/admin/members/:id/card.jpg renvoie un JPEG pour un administrateur", async () => {
    const res = await fetch(
      `${baseUrl}/api/admin/members/${memberWithCard._id}/card.jpg`,
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
});
