import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import Member from "../models/Member.js";
import PresenceSecurityQr from "../models/PresenceSecurityQr.js";
import {
  requirePresenceSession,
  signPresenceSessionToken,
} from "./presenceAuth.js";

const TEST_LAST_NAME = "TestSuitePresenceAuth";
const QR_LABEL = "TestSuitePresenceAuthQr";

let agent;
let qr;

const buildReq = (token) => ({
  headers: token ? { authorization: `Bearer ${token}` } : {},
});

// `requirePresenceSession` est enveloppé par `asyncHandler` : il
// retourne une promesse qui appelle `next(error)` en cas d'échec au
// lieu de rejeter. On capture cet appel plutôt que d'attendre un rejet.
const run = (req) =>
  new Promise((resolve) => {
    requirePresenceSession(req, {}, (error) => resolve(error));
  });

describe("requirePresenceSession (intégration MongoDB)", () => {
  before(async () => {
    await connectTestDb();
    await Promise.all([Member.init(), PresenceSecurityQr.init()]);

    await Member.deleteMany({ lastName: TEST_LAST_NAME });
    await PresenceSecurityQr.deleteMany({ label: QR_LABEL });

    agent = await Member.create({
      firstName: "Agent",
      lastName: TEST_LAST_NAME,
      role: "responsable",
      status: "actif",
      registrationNumber: "1XA26001A",
    });

    qr = await PresenceSecurityQr.create({
      label: QR_LABEL,
      validFrom: new Date(Date.now() - 60_000),
      validUntil: new Date(Date.now() + 60 * 60_000),
    });
  });

  beforeEach(async () => {
    await Member.updateOne(
      { _id: agent._id },
      { role: "responsable", status: "actif" }
    );
    await PresenceSecurityQr.updateOne({ _id: qr._id }, { status: "active" });
  });

  after(async () => {
    await Member.deleteMany({ lastName: TEST_LAST_NAME });
    await PresenceSecurityQr.deleteMany({ label: QR_LABEL });
    await disconnectTestDb();
  });

  it("laisse passer une session valide et peuple req.presenceAgent/req.presenceQr", async () => {
    const token = signPresenceSessionToken({ agent, qr });
    const req = buildReq(token);

    const error = await run(req);

    assert.equal(error, undefined);
    assert.equal(req.presenceAgent.registrationNumber, "1XA26001A");
    assert.equal(req.presenceQr.label, QR_LABEL);
  });

  it("refuse une requête sans jeton", async () => {
    const error = await run(buildReq());

    assert.equal(error.status, 401);
  });

  it("coupe l'accès immédiatement si le QR est révoqué en cours de session, même avec un jeton non expiré", async () => {
    const token = signPresenceSessionToken({ agent, qr });

    await PresenceSecurityQr.updateOne(
      { _id: qr._id },
      { status: "revoked" }
    );

    const error = await run(buildReq(token));

    assert.equal(error.status, 401);
  });

  it("coupe l'accès si l'agent est désactivé en cours de session", async () => {
    const token = signPresenceSessionToken({ agent, qr });

    await Member.updateOne({ _id: agent._id }, { status: "inactif" });

    const error = await run(buildReq(token));

    assert.equal(error.status, 401);
  });

  it("coupe l'accès si le rôle de l'agent redevient « membre » simple en cours de session", async () => {
    const token = signPresenceSessionToken({ agent, qr });

    await Member.updateOne({ _id: agent._id }, { role: "membre" });

    const error = await run(buildReq(token));

    assert.equal(error.status, 401);
  });
});
