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

    // Activation paresseuse (voir presenceQr.service.js#verifyToken) :
    // pas besoin de fenêtre fixée ici, `agentLogin` déclenche lui-même
    // l'activation au premier appel qui l'utilise, dans les tests
    // ci-dessous.
    qr = await PresenceSecurityQr.create({
      label: QR_LABEL,
      durationMinutes: 60,
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
        durationMinutes: 60,
        // Déjà activé il y a 2h, pour une durée de 60min : sa fenêtre
        // effective s'est donc terminée il y a 1h.
        activatedAt: new Date(Date.now() - 2 * 60 * 60_000),
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

    it("scan() renvoie une 404 (même message qu'un matricule inconnu) pour un membre désactivé — le matricule ne doit plus fonctionner nulle part sur le site", async () => {
      await assert.rejects(
        presenceService.scan(
          { registrationNumber: inactiveMember.registrationNumber },
          { id: agent._id },
          qr,
          fakeReq
        ),
        (error) => error.status === 404
      );

      const count = await Attendance.countDocuments({
        member: inactiveMember._id,
        securityQr: qr._id,
      });
      assert.equal(count, 0);
    });

    it("mark() renvoie une 404 pour un membre désactivé, même en ciblant directement son id", async () => {
      await assert.rejects(
        presenceService.mark(
          { memberId: inactiveMember._id },
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

    it("scan() reconnaît un badge invité pré-imprimé (INV-HOMME-01) sans recherche de membre", async () => {
      const first = await presenceService.scan(
        { registrationNumber: "INV-HOMME-01" },
        { id: agent._id },
        qr,
        fakeReq
      );

      assert.equal(first.kind, "visitor");
      assert.equal(first.alreadyRecorded, false);
      assert.equal(first.visitor.firstName, "Invité");
      assert.equal(first.visitor.lastName, "Homme 1");

      // Le même badge scanné deux fois pendant le même service ne
      // crée pas une deuxième présence (badge physique réutilisable,
      // pas une identité de visiteur comme un nom saisi à la main).
      const second = await presenceService.scan(
        { registrationNumber: "INV-HOMME-01" },
        { id: agent._id },
        qr,
        fakeReq
      );
      assert.equal(second.alreadyRecorded, true);

      const count = await Attendance.countDocuments({
        "visitor.badgeCode": "INV-HOMME-01",
        securityQr: qr._id,
      });
      assert.equal(count, 1);
    });

    it("scan() reconnaît un badge invité femme, distinct par genre/index", async () => {
      const result = await presenceService.scan(
        { registrationNumber: "INV-FEMME-03" },
        { id: agent._id },
        qr,
        fakeReq
      );

      assert.equal(result.kind, "visitor");
      assert.equal(result.visitor.lastName, "Femme 3");
    });

    it("scan() traite un code qui RESSEMBLE à un badge invité mais hors motif comme un matricule (404)", async () => {
      // "INV" seul, ou un index hors 01-05, ne doit jamais être
      // confondu avec un vrai badge — repli sur la recherche membre
      // habituelle, qui échoue proprement.
      await assert.rejects(
        presenceService.scan(
          { registrationNumber: "INV-HOMME-09" },
          { id: agent._id },
          qr,
          fakeReq
        ),
        (error) => error.status === 404
      );
    });

    it("scan() renvoie kind: 'member' pour un vrai matricule (pas de régression)", async () => {
      const result = await presenceService.scan(
        { registrationNumber: memberToScan.registrationNumber },
        { id: agent._id },
        qr,
        fakeReq
      );

      assert.equal(result.kind, "member");
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

  describe("markVisitor", () => {
    it("enregistre un visiteur sans dossier Member, sans jamais le dédupliquer", async () => {
      const first = await presenceService.markVisitor(
        { firstName: "Awa", lastName: "Traoré", phone: "0700000099", gender: "femme" },
        { id: agent._id },
        qr,
        fakeReq
      );

      assert.equal(first.alreadyRecorded, false);
      assert.equal(first.visitor.firstName, "Awa");
      assert.equal(first.visitor.phone, "0700000099");
      assert.equal(first.visitor.gender, "femme");

      const second = await presenceService.markVisitor(
        { firstName: "Awa", lastName: "Traoré", gender: "femme" },
        { id: agent._id },
        qr,
        fakeReq
      );

      // Même nom/prénom qu'au-dessus, mais AUCUNE identité stable côté
      // visiteur : chaque appel crée sa propre ligne, jamais fusionné.
      assert.equal(second.alreadyRecorded, false);

      const count = await Attendance.countDocuments({
        securityQr: qr._id,
        kind: "visitor",
      });
      assert.equal(count, 2);
    });

    it("refuse un visiteur sans prénom ou sans nom", async () => {
      await assert.rejects(
        presenceService.markVisitor(
          { firstName: "", lastName: "Traoré", gender: "femme" },
          { id: agent._id },
          qr,
          fakeReq
        ),
        (error) => error.status === 400
      );
    });

    it("refuse un visiteur sans genre, ou avec un genre invalide", async () => {
      await assert.rejects(
        presenceService.markVisitor(
          { firstName: "Awa", lastName: "Traoré" },
          { id: agent._id },
          qr,
          fakeReq
        ),
        (error) => error.status === 400
      );

      await assert.rejects(
        presenceService.markVisitor(
          { firstName: "Awa", lastName: "Traoré", gender: "autre" },
          { id: agent._id },
          qr,
          fakeReq
        ),
        (error) => error.status === 400
      );
    });
  });

  describe("listVisitors / buildVisitorsPdf", () => {
    it("liste uniquement nom/prénom, jamais le téléphone ni l'agent", async () => {
      await presenceService.markVisitor(
        { firstName: "Awa", lastName: "Traoré", phone: "0700000099", gender: "femme" },
        { id: agent._id },
        qr,
        fakeReq
      );

      const visitors = await presenceService.listVisitors(qr._id);

      assert.equal(visitors.length, 1);
      assert.equal(visitors[0].firstName, "Awa");
      assert.equal(visitors[0].lastName, "Traoré");
      assert.equal("phone" in visitors[0], false);
      assert.equal("agent" in visitors[0], false);
    });

    it("distingue un badge invité scanné (isBadge: true) d'un visiteur enregistré à la main (isBadge: false)", async () => {
      await presenceService.scan(
        { registrationNumber: "INV-HOMME-02" },
        { id: agent._id },
        qr,
        fakeReq
      );
      await presenceService.markVisitor(
        { firstName: "Awa", lastName: "Traoré", gender: "femme" },
        { id: agent._id },
        qr,
        fakeReq
      );

      const visitors = await presenceService.listVisitors(qr._id);
      const badge = visitors.find((visitor) => visitor.firstName === "Invité");
      const manual = visitors.find((visitor) => visitor.firstName === "Awa");

      assert.equal(badge.isBadge, true);
      assert.equal(manual.isBadge, false);
    });

    it("génère un PDF valide, même sans aucun visiteur", async () => {
      const buffer = await presenceService.buildVisitorsPdf(qr);

      assert.ok(Buffer.isBuffer(buffer));
      assert.equal(buffer.subarray(0, 5).toString("latin1"), "%PDF-");
    });

    it("génère un PDF valide avec des visiteurs des deux genres (totaux femme/homme)", async () => {
      await presenceService.markVisitor(
        { firstName: "Awa", lastName: "Traoré", gender: "femme" },
        { id: agent._id },
        qr,
        fakeReq
      );
      await presenceService.scan(
        { registrationNumber: "INV-HOMME-01" },
        { id: agent._id },
        qr,
        fakeReq
      );

      const buffer = await presenceService.buildVisitorsPdf(qr);

      assert.ok(Buffer.isBuffer(buffer));
      assert.equal(buffer.subarray(0, 5).toString("latin1"), "%PDF-");
    });
  });

  describe("countAttendance", () => {
    it("répartit le total entre membres et visiteurs", async () => {
      await presenceService.scan(
        { registrationNumber: memberToScan.registrationNumber },
        { id: agent._id },
        qr,
        fakeReq
      );
      await presenceService.markVisitor(
        { firstName: "Koffi", lastName: "N'Guessan", gender: "homme" },
        { id: agent._id },
        qr,
        fakeReq
      );

      const counts = await presenceService.countAttendance(qr._id);

      assert.deepEqual(counts, { total: 2, members: 1, visitors: 1 });
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
      assert.equal(records[0].kind, "member");
      assert.equal(records[0].member.registrationNumber, "1XP26004D");
      assert.equal(records[0].agent.registrationNumber, "1XP26001A");
      assert.equal(records[0].securityQr.label, QR_LABEL);
    });

    it("inclut les visiteurs, avec leur identité déclarée plutôt qu'un membre", async () => {
      await presenceService.markVisitor(
        { firstName: "Koffi", lastName: "N'Guessan", phone: "0700000098", gender: "homme" },
        { id: agent._id },
        qr,
        fakeReq
      );

      const records = await presenceService.listAttendance({
        securityQr: qr._id,
      });

      assert.equal(records.length, 1);
      assert.equal(records[0].kind, "visitor");
      assert.equal(records[0].member, null);
      assert.equal(records[0].visitor.firstName, "Koffi");
      assert.equal(records[0].visitor.phone, "0700000098");
    });
  });
});
