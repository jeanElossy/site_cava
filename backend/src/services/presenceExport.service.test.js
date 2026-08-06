import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import ExcelJS from "exceljs";

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
        gender: "homme",
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
      durationMinutes: 60,
      activatedAt: new Date(Date.now() - 60_000),
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
      visitor: { firstName: "Awa", lastName: "Traoré", gender: "femme" },
      securityQr: qr._id,
      agent: agent._id,
      method: "manual",
    });

    const buffer = await buildAttendanceXlsx(qr._id);

    assert.ok(Buffer.isBuffer(buffer));
    // Signature ZIP (les .xlsx sont des archives ZIP) : "PK".
    assert.equal(buffer.subarray(0, 2).toString("latin1"), "PK");
  });

  it("répartit femme/homme dans le résumé, membre et visiteur confondus", async () => {
    await Attendance.create({
      kind: "member",
      member: member._id, // gender: "homme"
      securityQr: qr._id,
      agent: agent._id,
      method: "scan",
    });
    await Attendance.create({
      kind: "visitor",
      visitor: { firstName: "Awa", lastName: "Traoré", gender: "femme" },
      securityQr: qr._id,
      agent: agent._id,
      method: "manual",
    });

    const buffer = await buildAttendanceXlsx(qr._id);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const summary = workbook.getWorksheet("Résumé");
    const rows = {};

    summary.eachRow((row) => {
      rows[row.getCell(1).value] = row.getCell(2).value;
    });

    assert.equal(rows["Total général"], 2);
    assert.equal(rows["Dont membres"], 1);
    assert.equal(rows["Dont visiteurs"], 1);
    assert.equal(rows["Dont femmes"], 1);
    assert.equal(rows["Dont hommes"], 1);
  });

  it("neutralise une identité de visiteur piégée en formule Excel (injection CSV/formule)", async () => {
    await Attendance.create({
      kind: "visitor",
      // Charge utile classique d'injection de formule : Excel
      // exécuterait cette commande à l'ouverture si elle n'était pas
      // neutralisée (voir utils/excelSafeCell.js).
      visitor: { firstName: "=cmd|'/c calc'!A1", lastName: "Traoré", gender: "femme" },
      securityQr: qr._id,
      agent: agent._id,
      method: "manual",
    });

    const buffer = await buildAttendanceXlsx(qr._id);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheet = workbook.getWorksheet("Présences");
    const firstNameCell = sheet.getRow(2).getCell(2).value;

    assert.equal(typeof firstNameCell, "string");
    assert.ok(firstNameCell.startsWith("'"));
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
      visitor: { firstName: "Awa", lastName: "Traoré", gender: "femme" },
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
