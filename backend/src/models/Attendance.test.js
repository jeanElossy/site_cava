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

  it("exige prénom et nom du visiteur quand kind vaut « visitor », mais pas member", () => {
    const doc = new Attendance({
      kind: "visitor",
      securityQr: new mongoose.Types.ObjectId(),
      agent: new mongoose.Types.ObjectId(),
      method: "manual",
    });

    const error = doc.validateSync();

    assert.ok(error.errors["visitor.firstName"]);
    assert.ok(error.errors["visitor.lastName"]);
    assert.equal(error.errors.member, undefined);
  });

  it("exige aussi le genre du visiteur quand kind vaut « visitor »", () => {
    const doc = new Attendance({
      kind: "visitor",
      visitor: { firstName: "Awa", lastName: "Traoré" },
      securityQr: new mongoose.Types.ObjectId(),
      agent: new mongoose.Types.ObjectId(),
      method: "manual",
    });

    assert.ok(doc.validateSync().errors["visitor.gender"]);
  });

  it("accepte un visiteur avec prénom, nom et genre, sans member", () => {
    const doc = new Attendance({
      kind: "visitor",
      visitor: { firstName: "Awa", lastName: "Traoré", gender: "femme" },
      securityQr: new mongoose.Types.ObjectId(),
      agent: new mongoose.Types.ObjectId(),
      method: "manual",
    });

    assert.equal(doc.validateSync(), undefined);
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

  it("l'index unique est PARTIEL (kind: member) : deux visiteurs sur le même QR ne collisionnent jamais", async () => {
    const first = await Attendance.create({
      kind: "visitor",
      visitor: { firstName: "Awa", lastName: "Traoré", gender: "femme" },
      securityQr,
      agent,
      method: "manual",
    });

    const second = await Attendance.create({
      kind: "visitor",
      visitor: { firstName: "Koffi", lastName: "N'Guessan", gender: "homme" },
      securityQr,
      agent,
      method: "manual",
    });

    assert.ok(first._id);
    assert.ok(second._id);

    await Attendance.deleteMany({ _id: { $in: [first._id, second._id] } });
  });
});
