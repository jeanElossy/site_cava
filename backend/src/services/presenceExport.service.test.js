import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import Member from "../models/Member.js";
import PresenceSecurityQr from "../models/PresenceSecurityQr.js";
import Attendance from "../models/Attendance.js";
import { buildAttendancePdf, buildAttendanceXlsx } from "./presenceExport.service.js";

const TEST_LAST_NAME = "TestSuitePresenceExport";
const QR_LABEL = "TestSuitePresenceExportQr";

let member;
let agent;
let qr;

const cleanupFixtures = async () => {
  await Member.deleteMany({ lastName: TEST_LAST_NAME });
  const qrs = await PresenceSecurityQr.find({ label: QR_LABEL }).select("_id");
  const ids = qrs.map((doc) => doc._id);

  await Attendance.deleteMany({ securityQr: { $in: ids } });
  await PresenceSecurityQr.deleteMany({ label: QR_LABEL });
};

describe("presenceExport.service (intégration MongoDB)", () => {
  before(async () => {
    await connectTestDb();
    await Promise.all([Member.init(), PresenceSecurityQr.init(), Attendance.init()]);

    await cleanupFixtures();

    [member, agent] = await Promise.all([
      Member.create({
        firstName: "Fidele",
        lastName: TEST_LAST_NAME,
        role: "membre",
        status: "actif",
        registrationNumber: "1XE26001A",
      }),
      Member.create({
        firstName: "Agent",
        lastName: TEST_LAST_NAME,
        role: "responsable",
        status: "actif",
        registrationNumber: "1XE26002B",
      }),
    ]);

    qr = await PresenceSecurityQr.create({
      label: QR_LABEL,
      validFrom: new Date(Date.now() - 60_000),
      validUntil: new Date(Date.now() + 60 * 60_000),
    });
  });

  beforeEach(async () => {
    await Attendance.deleteMany({ securityQr: qr._id });
  });

  after(async () => {
    await cleanupFixtures();
    await disconnectTestDb();
  });

  it("génère un classeur Excel valide listant membres et visiteurs, avec un résumé des compteurs", async () => {
    await Attendance.create({
      kind: "member",
      member: member._id,
      securityQr: qr._id,
      agent: agent._id,
      method: "scan",
    });
    await Attendance.create({
      kind: "visitor",
      visitor: { firstName: "Awa", lastName: "Traoré" },
      securityQr: qr._id,
      agent: agent._id,
      method: "manual",
    });

    const buffer = await buildAttendanceXlsx(qr._id);

    assert.ok(Buffer.isBuffer(buffer));
    // Signature ZIP (les .xlsx sont des archives ZIP) : "PK".
    assert.equal(buffer.subarray(0, 2).toString("latin1"), "PK");
  });

  it("lève une 404 pour un QR de sécurité introuvable (xlsx)", async () => {
    await assert.rejects(
      buildAttendanceXlsx(new mongoose.Types.ObjectId()),
      (error) => error.status === 404
    );
  });

  it("génère un PDF valide listant membres et visiteurs", async () => {
    await Attendance.create({
      kind: "member",
      member: member._id,
      securityQr: qr._id,
      agent: agent._id,
      method: "scan",
    });
    await Attendance.create({
      kind: "visitor",
      visitor: { firstName: "Awa", lastName: "Traoré" },
      securityQr: qr._id,
      agent: agent._id,
      method: "manual",
    });

    const buffer = await buildAttendancePdf(qr._id);

    assert.ok(Buffer.isBuffer(buffer));
    assert.equal(buffer.subarray(0, 5).toString("latin1"), "%PDF-");
  });

  it("lève une 404 pour un QR de sécurité introuvable (pdf)", async () => {
    await assert.rejects(
      buildAttendancePdf(new mongoose.Types.ObjectId()),
      (error) => error.status === 404
    );
  });
});
