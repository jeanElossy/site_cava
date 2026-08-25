import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import { signToken } from "../middlewares/auth.js";
import User from "../models/User.js";
import PushSubscription from "../models/PushSubscription.js";

const { createApp } = await import("../app.js");

const EMAIL_SUFFIX = "@example.invalid";
const EMAIL_PREFIX = "push.testsuite.routes";

let server;
let baseUrl;
let soaToken;
let soaUserId;

const json = async (res) => res.json();

describe("Routes des notifications push (intégration HTTP)", () => {
  before(async () => {
    await connectTestDb();

    await User.deleteMany({ email: { $regex: `${EMAIL_PREFIX}.*${EMAIL_SUFFIX}$` } });

    const soaUser = await User.create({
      name: "Agent SOA Push Route Test",
      email: `${EMAIL_PREFIX}${EMAIL_SUFFIX}`,
      registrationNumber: "5AA00501G",
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
    await PushSubscription.deleteMany({ user: soaUserId });
    await User.deleteOne({ _id: soaUserId });
    await new Promise((resolve) => server.close(resolve));
    await disconnectTestDb();
  });

  it("GET /api/push/vapid-public-key est accessible sans authentification", async () => {
    const res = await fetch(`${baseUrl}/api/push/vapid-public-key`);
    assert.equal(res.status, 200);

    const { data } = await json(res);
    assert.ok(typeof data.publicKey === "string" || data.publicKey === null);
  });

  it("POST /api/admin/push/subscribe exige une authentification", async () => {
    const res = await fetch(`${baseUrl}/api/admin/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    assert.equal(res.status, 401);
  });

  it("parcours complet abonnement/désabonnement pour un compte SOA", async () => {
    const endpoint = "https://push.example.invalid/route-test-endpoint";

    const subscribeRes = await fetch(`${baseUrl}/api/admin/push/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${soaToken}`,
      },
      body: JSON.stringify({
        endpoint,
        keys: { p256dh: "clé-p256dh", auth: "clé-auth" },
      }),
    });
    assert.equal(subscribeRes.status, 200);

    const stored = await PushSubscription.findOne({ endpoint }).lean();
    assert.equal(String(stored.user), String(soaUserId));

    const unsubscribeRes = await fetch(`${baseUrl}/api/admin/push/unsubscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${soaToken}`,
      },
      body: JSON.stringify({ endpoint }),
    });
    assert.equal(unsubscribeRes.status, 200);

    const gone = await PushSubscription.findOne({ endpoint });
    assert.equal(gone, null);
  });
});
