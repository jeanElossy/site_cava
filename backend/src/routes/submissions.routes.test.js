import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import { createApp } from "../app.js";
import { signToken } from "../middlewares/auth.js";
import User from "../models/User.js";
import Member from "../models/Member.js";
import MemberSubmission from "../models/MemberSubmission.js";

// Tests d'intégration HTTP de bout en bout (Task 5) : démarre la vraie
// application Express sur un port éphémère, sans passer par le script
// serveur — aucune dépendance ajoutée, `fetch` et `http` sont fournis
// par Node.
//
// Isolation : compte administrateur RÉEL réutilisé pour son rôle
// (signToken() mint un jeton de session directement, sans passer par
// le mot de passe ni la double authentification — requireAuth ne
// vérifie que la validité du jeton et recharge l'utilisateur, peu
// importe comment le jeton a été obtenu). Un compte "editor" jetable
// est créé pour vérifier le refus de rôle, puis supprimé.
const TEST_LAST_NAME = "TestSuiteRoutes";
const EDITOR_EMAIL = "editor.testsuite.routes@example.invalid";

let server;
let baseUrl;
let adminToken;
let editorToken;
let editorUserId;

const cleanupSubmissions = () =>
  MemberSubmission.deleteMany({ "data.lastName": TEST_LAST_NAME });

describe("Routes bergeries et soumissions (intégration HTTP)", () => {
  before(async () => {
    await connectTestDb();

    const adminUser = await User.findOne({ role: "admin" }).lean();
    assert.ok(
      adminUser,
      "Un utilisateur admin doit exister en base pour ce test."
    );
    adminToken = signToken({ _id: adminUser._id, role: "admin" });

    const editorUser = await User.create({
      name: "Éditeur Test Suite",
      email: EDITOR_EMAIL,
      password: "MotDePasseTemporaire123!",
      role: "editor",
    });
    editorUserId = editorUser._id;
    editorToken = signToken({ _id: editorUser._id, role: "editor" });

    const app = createApp();
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  beforeEach(cleanupSubmissions);

  after(async () => {
    await cleanupSubmissions();
    await Member.deleteMany({ lastName: TEST_LAST_NAME });
    await User.deleteOne({ _id: editorUserId });
    await new Promise((resolve) => server.close(resolve));
    await disconnectTestDb();
  });

  it("GET /api/flocks est public et renvoie la liste des bergeries publiées", async () => {
    const res = await fetch(`${baseUrl}/api/flocks`);
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
  });

  it("POST /api/submissions est public et crée une soumission en attente", async () => {
    const res = await fetch(`${baseUrl}/api/submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "new",
        data: { firstName: "Route", lastName: TEST_LAST_NAME },
      }),
    });
    const json = await res.json();

    assert.equal(res.status, 201);
    assert.deepEqual(json.data, { received: true });

    const stored = await MemberSubmission.findOne({
      "data.lastName": TEST_LAST_NAME,
    }).lean();
    assert.ok(stored);
    assert.equal(stored.status, "pending");
  });

  it("GET /api/admin/submissions exige une authentification (401 sans jeton)", async () => {
    const res = await fetch(`${baseUrl}/api/admin/submissions`);
    assert.equal(res.status, 401);
  });

  it("GET /api/admin/submissions refuse un compte non-admin (403) — données personnelles réservées aux administrateurs", async () => {
    const res = await fetch(`${baseUrl}/api/admin/submissions`, {
      headers: { Authorization: `Bearer ${editorToken}` },
    });
    assert.equal(res.status, 403);
  });

  it("GET /api/admin/submissions autorise un administrateur et renvoie les soumissions en attente", async () => {
    await fetch(`${baseUrl}/api/submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "new",
        data: { firstName: "Route2", lastName: TEST_LAST_NAME },
      }),
    });

    const res = await fetch(`${baseUrl}/api/admin/submissions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.ok(
      json.data.some((item) => item.data.lastName === TEST_LAST_NAME)
    );
  });

  it("POST /api/admin/submissions/:id/approve refuse un compte non-admin (403)", async () => {
    const res = await fetch(
      `${baseUrl}/api/admin/submissions/${new mongoose.Types.ObjectId()}/approve`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${editorToken}`,
        },
        body: JSON.stringify({}),
      }
    );
    assert.equal(res.status, 403);
  });

  it("submissionLimiter bloque après 5 soumissions publiques dans la fenêtre", async () => {
    const attempt = () =>
      fetch(`${baseUrl}/api/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "new",
          data: { firstName: "Limite", lastName: TEST_LAST_NAME },
        }),
      });

    const statuses = [];
    for (let i = 0; i < 6; i += 1) {
      const res = await attempt();
      statuses.push(res.status);
    }

    // Les 5 premières passent (429 pas encore atteint), la 6e est
    // bloquée. Comme d'autres tests de ce même fichier ont déjà
    // consommé une partie du quota (même IP, même fenêtre), on
    // vérifie seulement qu'au moins un 429 apparaît et que la dernière
    // tentative est bien bloquée.
    assert.equal(statuses.at(-1), 429);
  });
});
