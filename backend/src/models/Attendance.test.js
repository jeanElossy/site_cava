import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import Attendance from "./Attendance.js";

describe("Attendance (modèle) — validation du schéma (sans base)", () => {
  it("exige member, securityQr, agent et method", () => {
    const doc = new Attendance({});
    const error = doc.validateSync();

    assert.ok(error.errors.member);
    assert.ok(error.errors.securityQr);
    assert.ok(error.errors.agent);
    assert.ok(error.errors.method);
  });

  it("refuse une méthode hors de « scan »/« manual »", () => {
    const doc = new Attendance({
      member: new mongoose.Types.ObjectId(),
      securityQr: new mongoose.Types.ObjectId(),
      agent: new mongoose.Types.ObjectId(),
      method: "autre",
    });

    assert.ok(doc.validateSync().errors.method);
  });
});

describe("Attendance (modèle) — idempotence (intégration MongoDB)", () => {
  const member = new mongoose.Types.ObjectId();
  const securityQr = new mongoose.Types.ObjectId();
  const agent = new mongoose.Types.ObjectId();

  before(async () => {
    await connectTestDb();
    await Attendance.init();
  });

  beforeEach(async () => {
    await Attendance.deleteMany({ member, securityQr });
  });

  after(async () => {
    await Attendance.deleteMany({ member, securityQr });
    await disconnectTestDb();
  });

  it("l'index unique {member, securityQr} rejette une seconde présence pour le même service", async () => {
    await Attendance.create({ member, securityQr, agent, method: "scan" });

    await assert.rejects(
      Attendance.create({ member, securityQr, agent, method: "scan" }),
      (error) => error.code === 11000
    );
  });

  it("le même membre peut avoir une présence sur deux QR de sécurité différents", async () => {
    const otherQr = new mongoose.Types.ObjectId();

    await Attendance.create({ member, securityQr, agent, method: "scan" });
    const second = await Attendance.create({
      member,
      securityQr: otherQr,
      agent,
      method: "manual",
    });

    assert.ok(second._id);
    await Attendance.deleteOne({ _id: second._id });
  });
});
