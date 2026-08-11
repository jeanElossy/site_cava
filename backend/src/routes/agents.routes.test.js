import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import { signToken } from "../middlewares/auth.js";
import User from "../models/User.js";
import Member from "../models/Member.js";

const { createApp } = await import("../app.js");

// Un agent se connecte par matricule (voir User.js) ; la création via
// l'API HTTP passe par agent.service.js#create, qui exige un membre
// réellement enregistré pour ce matricule — d'où le membre fixture
// ci-dessous, sur une église/bergerie improbable en production réelle,
// nettoyé par identifiant exact.
const SOA_MATRICULE = "5ZZ99101A";
const CANA_MATRICULE = "5ZZ99102A";

let server;
let baseUrl;
let adminToken;
let soaToken;
let soaUserId;
let memberIds = [];

const json = async (res) => res.json();

const createdAgentIds = [];

describe("Routes des agents (intégration HTTP)", () => {
  before(async () => {
    await connectTestDb();

    const soaMember = await Member.create({
      firstName: "Fixture",
      lastName: "SoaRouteTest",
      church: 5,
      status: "actif",
      registrationNumber: SOA_MATRICULE,
    });
    const canaMember = await Member.create({
      firstName: "Fixture",
      lastName: "CanaRouteTest",
      church: 5,
      status: "actif",
      registrationNumber: CANA_MATRICULE,
    });
    memberIds = [soaMember._id, canaMember._id];

    const adminUser = await User.findOne({ role: "admin" }).lean();
    assert.ok(adminUser, "Un utilisateur admin doit exister en base pour ce test.");
    adminToken = signToken({ _id: adminUser._id, role: "admin" });

    const soaUser = await User.create({
      name: "Agent SOA Route Test",
      registrationNumber: SOA_MATRICULE,
      password: "MotDePasseTemporaire123!",
      role: "soa",
    });
    soaUserId = soaUser._id;
    soaToken = signToken({ _id: soaUser._id, role: "soa" });

    const app = createApp();
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await User.deleteMany({ _id: { $in: [...createdAgentIds, soaUserId] } });
    await Member.deleteMany({ _id: { $in: memberIds } });
    await new Promise((resolve) => server.close(resolve));
    await disconnectTestDb();
  });

  it("GET /api/admin/agents exige une authentification (401 sans jeton)", async () => {
    const res = await fetch(`${baseUrl}/api/admin/agents`);
    assert.equal(res.status, 401);
  });

  it("GET /api/admin/agents refuse un compte non-admin (403)", async () => {
    const res = await fetch(`${baseUrl}/api/admin/agents`, {
      headers: { Authorization: `Bearer ${soaToken}` },
    });
    assert.equal(res.status, 403);
  });

  it("parcours complet CRUD via l'API HTTP, réservé à l'admin", async () => {
    const createRes = await fetch(`${baseUrl}/api/admin/agents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Nouvel Agent CANA",
        registrationNumber: CANA_MATRICULE,
        password: "MotDePasseTemporaire123!",
        role: "cana",
      }),
    });
    assert.equal(createRes.status, 201);
    const created = (await json(createRes)).data;
    createdAgentIds.push(created.id);
    assert.equal(created.role, "cana");

    const listRes = await fetch(`${baseUrl}/api/admin/agents?role=cana`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(listRes.status, 200);
    const list = (await json(listRes)).data;
    assert.ok(list.some((item) => item.id === created.id));

    const updateRes = await fetch(`${baseUrl}/api/admin/agents/${created.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: "Agent CANA Renommé" }),
    });
    assert.equal(updateRes.status, 200);
    assert.equal((await json(updateRes)).data.name, "Agent CANA Renommé");

    const statusRes = await fetch(`${baseUrl}/api/admin/agents/${created.id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: false }),
    });
    assert.equal(statusRes.status, 200);
    assert.equal((await json(statusRes)).data.isActive, false);

    const resetRes = await fetch(`${baseUrl}/api/admin/agents/${created.id}/reset-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ password: "AutreMotDePasse789!" }),
    });
    assert.equal(resetRes.status, 200);

    const deleteRes = await fetch(`${baseUrl}/api/admin/agents/${created.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(deleteRes.status, 204);

    const afterDeleteRes = await fetch(`${baseUrl}/api/admin/agents?role=cana`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const afterDeleteList = (await json(afterDeleteRes)).data;
    assert.ok(!afterDeleteList.some((item) => item.id === created.id));
  });

  it("POST /api/admin/agents refuse un rôle admin/editor (400)", async () => {
    const res = await fetch(`${baseUrl}/api/admin/agents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Tentative Admin",
        registrationNumber: "5ZZ99199Z",
        password: "MotDePasseTemporaire123!",
        role: "admin",
      }),
    });
    assert.equal(res.status, 400);
  });
});
