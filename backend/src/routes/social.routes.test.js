import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import { signToken } from "../middlewares/auth.js";
import User from "../models/User.js";
import SocialFundSettings from "../models/SocialFundSettings.js";
import SocialContribution from "../models/SocialContribution.js";
import SocialLedgerEntry from "../models/SocialLedgerEntry.js";
import Member from "../models/Member.js";

const { createApp } = await import("../app.js");

// Église 5 : voir l'écart assumé documenté en tête de
// socialContribution.service.test.js — Member.church rejette 9, donc
// l'église 5 (dans la vraie plage 1-5, sans membre actif réel ni
// SocialFundSettings existant à ce jour) sert d'église de test isolée.
const TEST_CHURCH = 5;

const EMAIL_SUFFIX = "@example.invalid";
const EMAIL_PREFIX = "social.testsuite.routes";

let server;
let baseUrl;

let viewerUser;
let viewerToken;
let agentUser;
let agentToken;

const json = async (res) => res.json();

const authed = (token, init = {}) => ({
  ...init,
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...(init.headers ?? {}),
  },
});

describe("Routes du Service Social (intégration HTTP)", () => {
  before(async () => {
    await connectTestDb();

    await User.deleteMany({
      email: { $regex: `${EMAIL_PREFIX}.*${EMAIL_SUFFIX}$` },
    });
    await SocialFundSettings.deleteMany({ church: TEST_CHURCH });
    await SocialContribution.deleteMany({ church: TEST_CHURCH });
    await SocialLedgerEntry.deleteMany({ church: TEST_CHURCH });
    await Member.deleteMany({ church: TEST_CHURCH });

    viewerUser = await User.create({
      name: "Viewer Test Service Social",
      email: `${EMAIL_PREFIX}.viewer${EMAIL_SUFFIX}`,
      password: "MotDePasseTemporaire123!",
      role: "social_viewer",
    });
    viewerToken = signToken({ _id: viewerUser._id, role: "social_viewer" });

    agentUser = await User.create({
      name: "Agent Test Service Social",
      email: `${EMAIL_PREFIX}.agent${EMAIL_SUFFIX}`,
      password: "MotDePasseTemporaire123!",
      role: "social_agent",
    });
    agentToken = signToken({ _id: agentUser._id, role: "social_agent" });

    await SocialFundSettings.create({
      church: TEST_CHURCH,
      monthlyContributionAmount: 1000,
      openingBalance: 0,
    });

    const app = createApp();
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await SocialFundSettings.deleteMany({ church: TEST_CHURCH });
    await SocialContribution.deleteMany({ church: TEST_CHURCH });
    await SocialLedgerEntry.deleteMany({ church: TEST_CHURCH });
    await Member.deleteMany({ church: TEST_CHURCH });
    await User.deleteMany({
      _id: { $in: [viewerUser._id, agentUser._id] },
    });
    await new Promise((resolve) => server.close(resolve));
    await disconnectTestDb();
  });

  it("exige une authentification sur toutes les routes", async () => {
    const res = await fetch(`${baseUrl}/api/admin/social/dashboard`);
    assert.equal(res.status, 401);
  });

  it("social_viewer peut lire le dashboard et les réglages", async () => {
    const dashboardRes = await fetch(
      `${baseUrl}/api/admin/social/dashboard?church=${TEST_CHURCH}`,
      authed(viewerToken)
    );
    assert.equal(dashboardRes.status, 200);

    const settingsRes = await fetch(
      `${baseUrl}/api/admin/social/settings`,
      authed(viewerToken)
    );
    assert.equal(settingsRes.status, 200);
  });

  it("social_viewer reçoit 403 sur POST /contributions", async () => {
    const res = await fetch(
      `${baseUrl}/api/admin/social/contributions`,
      authed(viewerToken, {
        method: "POST",
        body: JSON.stringify({
          memberId: new mongoose.Types.ObjectId().toString(),
          payments: [{ year: 2025, month: 1, amount: 1000 }],
        }),
      })
    );

    assert.equal(res.status, 403);
  });

  it("social_viewer reçoit 403 sur PATCH /settings/:church", async () => {
    const res = await fetch(
      `${baseUrl}/api/admin/social/settings/${TEST_CHURCH}`,
      authed(viewerToken, {
        method: "PATCH",
        body: JSON.stringify({ monthlyContributionAmount: 2000 }),
      })
    );

    assert.equal(res.status, 403);
  });

  it("social_agent reçoit 403 sur PATCH .../exonerer", async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();

    const res = await fetch(
      `${baseUrl}/api/admin/social/contributions/${fakeId}/exonerer`,
      authed(agentToken, {
        method: "PATCH",
        body: JSON.stringify({ motif: "Test" }),
      })
    );

    assert.equal(res.status, 403);
  });

  it("social_agent peut enregistrer un paiement", async () => {
    const member = await Member.create({
      firstName: "Route",
      lastName: "TestSocial",
      church: TEST_CHURCH,
      status: "actif",
    });

    const res = await fetch(
      `${baseUrl}/api/admin/social/contributions`,
      authed(agentToken, {
        method: "POST",
        body: JSON.stringify({
          memberId: String(member._id),
          payments: [{ year: 2025, month: 3, amount: 1000 }],
        }),
      })
    );

    assert.equal(res.status, 201);

    const body = await json(res);
    assert.equal(body.data.results[0].ok, true);
    assert.equal(body.data.results[0].status, "paye");
  });
});
