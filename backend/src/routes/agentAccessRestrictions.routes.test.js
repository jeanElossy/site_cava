import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import { signToken } from "../middlewares/auth.js";
import User from "../models/User.js";

const { createApp } = await import("../app.js");

const EMAIL_SUFFIX = "@example.invalid";
const EMAIL_PREFIX = "agent.testsuite.access";

let server;
let baseUrl;
let soaToken;
let soaUserId;

// Un compte "agent" (soa/cana/coordinateur_bergeries/pasteur) ne doit
// voir, une fois connecté, que le module Nouvelles Âmes — voir
// RequireRole.jsx côté front, et ici la vraie barrière côté API (voir
// routes/index.js). Ce fichier verrouille cette restriction contre une
// régression future : sans lui, rien n'aurait échoué si quelqu'un
// retirait par erreur un `requireRole(...)`.
describe("Restriction d'accès des comptes agents aux modules hors Nouvelles Âmes (intégration HTTP)", () => {
  before(async () => {
    await connectTestDb();

    await User.deleteMany({ email: { $regex: `${EMAIL_PREFIX}.*${EMAIL_SUFFIX}$` } });

    const soaUser = await User.create({
      name: "Agent SOA Restrictions Test",
      email: `${EMAIL_PREFIX}${EMAIL_SUFFIX}`,
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
    await User.deleteOne({ _id: soaUserId });
    await new Promise((resolve) => server.close(resolve));
    await disconnectTestDb();
  });

  const cases = [
    ["/api/admin/messages", "les messages reçus"],
    ["/api/admin/donations", "les dons"],
    ["/api/admin/newsletter", "les abonnés à la newsletter"],
    ["/api/admin/members", "l'annuaire des membres"],
  ];

  for (const [path, label] of cases) {
    it(`GET ${path} refuse un compte SOA (403) — ${label}`, async () => {
      const res = await fetch(`${baseUrl}${path}`, {
        headers: { Authorization: `Bearer ${soaToken}` },
      });

      assert.equal(res.status, 403);
    });
  }

  it("GET /api/admin/new-souls reste accessible à un compte SOA", async () => {
    const res = await fetch(`${baseUrl}/api/admin/new-souls`, {
      headers: { Authorization: `Bearer ${soaToken}` },
    });

    assert.equal(res.status, 200);
  });
});
