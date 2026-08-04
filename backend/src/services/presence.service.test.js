import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import Member from "../models/Member.js";
import PresenceSecurityQr from "../models/PresenceSecurityQr.js";
import PresenceLogin from "../models/PresenceLogin.js";
import Attendance from "../models/Attendance.js";
import { signPresenceQrToken } from "../middlewares/presenceAuth.js";
import * as presenceService from "./presence.service.js";

// Nom de famille improbable en production, pour isoler et nettoyer ce
// que ce fichier crée (même base que le développement — voir
// test/db.js). Chaque membre a son propre matricule fictif
// 1XP26xxxL, hors des plages réelles observées.
const TEST_LAST_NAME = "TestSuitePresence";
const QR_LABEL = "TestSuitePresenceServiceQr";

let agent; // rôle habilité, actif
let disallowedRoleAgent; // rôle "membre", non habilité
let inactiveAgent; // rôle habilité mais inactif
let memberToScan;
let inactiveMember;
let qr;

const fakeReq = { ip: "127.0.0.1", headers: { "user-agent": "test-suite" } };

const cleanupFixtures = async () => {
  await Member.deleteMany({ lastName: TEST_LAST_NAME });
  const qrs = await PresenceSecurityQr.find({ label: QR_LABEL }).select("_id");
  const ids = qrs.map((doc) => doc._id);

  await Attendance.deleteMany({ securityQr: { $in: ids } });
  await PresenceLogin.deleteMany({ securityQr: { $in: ids } });
  await PresenceSecurityQr.deleteMany({ label: QR_LABEL });
};

describe("presence.service (intégration MongoDB)", () => {
  before(async () => {
    await connectTestDb();
    await Promise.all([
      Member.init(),
      PresenceSecurityQr.init(),
      Attendance.init(),
      PresenceLogin.init(),
    ]);

    await cleanupFixtures();

    [agent, disallowedRoleAgent, inactiveAgent, memberToScan, inactiveMember] =
      await Promise.all([
        Member.create({
          firstName: "Agent",
          lastName: TEST_LAST_NAME,
          role: "responsable",
          status: "actif",
          registrationNumber: "1XP26001A",
        }),
        Member.create({
          firstName: "SimpleMembre",
          lastName: TEST_LAST_NAME,
          role: "membre",
          status: "actif",
          registrationNumber: "1XP26002B",
        }),
        Member.create({
          firstName: "AgentInactif",
          lastName: TEST_LAST_NAME,
          role: "pasteur",
          status: "inactif",
          registrationNumber: "1XP26003C",
        }),
        Member.create({
          firstName: "Fidele",
          lastName: TEST_LAST_NAME,
          role: "membre",
          status: "actif",
          registrationNumber: "1XP26004D",
          phone: "0700000004",
        }),
        Member.create({
          firstName: "FideleInactif",
          lastName: TEST_LAST_NAME,
          role: "membre",
          status: "inactif",
          registrationNumber: "1XP26005E",
          phone: "0700000005",
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
    await PresenceLogin.deleteMany({ securityQr: qr._id });
  });

  after(async () => {
    await cleanupFixtures();
    await disconnectTestDb();
  });

  describe("agentLogin", () => {
    it("connecte un agent avec un rôle habilité et journalise la connexion", async () => {
      const token = signPresenceQrToken(qr);

      const result = await presenceService.agentLogin(
        { token, matricule: "1xp 26-001 a" },
        fakeReq
      );

      assert.equal(typeof result.sessionToken, "string");
      assert.equal(result.agent.registrationNumber, "1XP26001A");

      const logins = await PresenceLogin.countDocuments({ securityQr: qr._id });
      assert.equal(logins, 1);
    });

    it("refuse un rôle non habilité, avec le même message qu'un matricule inconnu", async () => {
      const token = signPresenceQrToken(qr);

      await assert.rejects(
        presenceService.agentLogin(
          { token, matricule: "1XP26002B" },
          fakeReq
        ),
        (error) =>
          error.status === 401 &&
          error.message === "Matricule inconnu ou non habilité au badgeage."
      );
    });

    it("refuse un agent inactif", async () => {
      const token = signPresenceQrToken(qr);

      await assert.rejects(
        presenceService.agentLogin(
          { token, matricule: "1XP26003C" },
          fakeReq
        ),
        (error) =>
          error.status === 401 &&
          error.message === "Matricule inconnu ou non habilité au badgeage."
      );
    });

    it("refuse un matricule inconnu", async () => {
      const token = signPresenceQrToken(qr);

      await assert.rejects(
        presenceService.agentLogin(
          { token, matricule: "1XP26099Z" },
          fakeReq
        ),
        (error) => error.status === 401
      );
    });

    it("refuse un QR expiré, avant même de regarder le matricule", async () => {
      const expiredQr = await PresenceSecurityQr.create({
        label: QR_LABEL,
        validFrom: new Date(Date.now() - 2 * 60 * 60_000),
        validUntil: new Date(Date.now() - 60 * 60_000),
      });

      const token = signPresenceQrToken(expiredQr);

      await assert.rejects(
        presenceService.agentLogin(
          { token, matricule: "1XP26001A" },
          fakeReq
        ),
        (error) =>
          error.status === 401 &&
          error.message === "Ce QR de sécurité a expiré."
      );

      await PresenceSecurityQr.deleteOne({ _id: expiredQr._id });
    });
  });

  describe("scan / mark — idempotence", () => {
    it("scan() enregistre la présence puis la retrouve, sans doublon, aux scans suivants", async () => {
      const first = await presenceService.scan(
        { registrationNumber: memberToScan.registrationNumber },
        { id: agent._id },
        qr,
        fakeReq
      );

      assert.equal(first.alreadyRecorded, false);
      assert.equal(first.member.registrationNumber, "1XP26004D");

      const second = await presenceService.scan(
        { registrationNumber: memberToScan.registrationNumber },
        { id: agent._id },
        qr,
        fakeReq
      );

      assert.equal(second.alreadyRecorded, true);
      assert.equal(
        second.recordedAt.getTime(),
        first.recordedAt.getTime()
      );

      const count = await Attendance.countDocuments({
        member: memberToScan._id,
        securityQr: qr._id,
      });
      assert.equal(count, 1);
    });

    it("scan() renvoie une 404 pour un matricule de membre inconnu", async () => {
      await assert.rejects(
        presenceService.scan(
          { registrationNumber: "1XP26099Z" },
          { id: agent._id },
          qr,
          fakeReq
        ),
        (error) => error.status === 404
      );
    });

    it("mark() (« carte oubliée ») partage le même verrou d'idempotence que scan()", async () => {
      const scanned = await presenceService.scan(
        { registrationNumber: memberToScan.registrationNumber },
        { id: agent._id },
        qr,
        fakeReq
      );
      assert.equal(scanned.alreadyRecorded, false);

      const marked = await presenceService.mark(
        { memberId: memberToScan._id },
        { id: agent._id },
        qr,
        fakeReq
      );

      assert.equal(marked.alreadyRecorded, true);
    });
  });

  describe("search", () => {
    it("trouve un membre actif par matricule, nom, prénom ou téléphone, insensible à la casse", async () => {
      const byRegistrationNumber = await presenceService.search("1xp26004d");
      const byLastName = await presenceService.search("testsuitepresence");
      const byPhone = await presenceService.search("0700000004");

      for (const results of [byRegistrationNumber, byPhone]) {
        assert.ok(
          results.some((m) => m.registrationNumber === "1XP26004D")
        );
      }

      assert.ok(byLastName.length >= 1);
    });

    it("exclut les membres inactifs", async () => {
      const results = await presenceService.search("0700000005");

      assert.equal(results.length, 0);
    });

    it("échappe les caractères spéciaux de regex sans lever d'erreur", async () => {
      const results = await presenceService.search("a.*b(c");

      assert.ok(Array.isArray(results));
    });
  });

  describe("listAttendance", () => {
    it("liste les présences d'un QR, les plus récentes en premier, avec membre/agent peuplés", async () => {
      await presenceService.scan(
        { registrationNumber: memberToScan.registrationNumber },
        { id: agent._id },
        qr,
        fakeReq
      );

      const records = await presenceService.listAttendance({
        securityQr: qr._id,
      });

      assert.equal(records.length, 1);
      assert.equal(records[0].member.registrationNumber, "1XP26004D");
      assert.equal(records[0].agent.registrationNumber, "1XP26001A");
      assert.equal(records[0].securityQr.label, QR_LABEL);
    });
  });
});
