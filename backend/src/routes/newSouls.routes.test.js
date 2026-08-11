import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import { signToken } from "../middlewares/auth.js";
import { signPresenceSessionToken } from "../middlewares/presenceAuth.js";
import User from "../models/User.js";
import Flock from "../models/Flock.js";
import NewSoul from "../models/NewSoul.js";
import Member from "../models/Member.js";
import RegistrationCounter from "../models/RegistrationCounter.js";

const { createApp } = await import("../app.js");

const FLOCK_CODE = "AR";
const EMAIL_SUFFIX = "@example.invalid";
// Église FICTIVE, distincte de celle de newSoul.service.test.js (4) :
// la route de clôture crée un Member via `nextRegistrationNumber`, qui
// incrémente le compteur RÉEL de l'église concernée. Utiliser l'église
// réelle (1) ici a fait dériver le compteur réel en production — voir
// le commentaire équivalent dans newSoul.service.test.js.
const TEST_CHURCH = 5;

let server;
let baseUrl;
let soaToken;
let canaToken;
let flock;
let soaUserId;
let canaUserId;

const json = async (res) => res.json();

// Suivi explicite des dossiers créés par ce fichier plutôt qu'un
// nettoyage par préfixe de numéro de dossier ("AN-", partagé par
// TOUS les tests du module) — voir le commentaire équivalent dans
// newSoul.service.test.js, qui a révélé l'interférence entre les deux
// fichiers exécutés en parallèle par `node --test`.
const createdIds = [];

describe("Routes des nouvelles âmes (intégration HTTP)", () => {
  before(async () => {
    await connectTestDb();
    await Promise.all([Flock.init(), NewSoul.init(), Member.init()]);

    const soaUser = await User.create({
      name: "Agent SOA Route Test",
      email: `soa.testsuite.newsoulroutes${EMAIL_SUFFIX}`,
      password: "MotDePasseTemporaire123!",
      role: "soa",
    });
    const canaUser = await User.create({
      name: "Responsable CANA Route Test",
      email: `cana.testsuite.newsoulroutes${EMAIL_SUFFIX}`,
      password: "MotDePasseTemporaire123!",
      role: "cana",
    });

    soaUserId = soaUser._id;
    canaUserId = canaUser._id;
    soaToken = signToken({ _id: soaUser._id, role: "soa" });
    canaToken = signToken({ _id: canaUser._id, role: "cana" });

    flock = await Flock.create({
      code: FLOCK_CODE,
      name: "Bergerie Test Routes Nouvelles Âmes",
      church: TEST_CHURCH,
    });

    const app = createApp();
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await NewSoul.deleteMany({ _id: { $in: createdIds } });
    await Member.deleteMany({ flock: flock._id });
    await Flock.deleteOne({ _id: flock._id });
    await User.deleteMany({ _id: { $in: [soaUserId, canaUserId] } });
    // Église fictive, jamais réelle : purge sans condition, aucune
    // valeur "d'avant le test" à préserver.
    await RegistrationCounter.deleteOne({ church: TEST_CHURCH });
    await new Promise((resolve) => server.close(resolve));
    await disconnectTestDb();
  });

  it("POST /api/admin/new-souls exige une authentification (401 sans jeton)", async () => {
    const res = await fetch(`${baseUrl}/api/admin/new-souls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: "Jean", lastName: "Kouassi", phone: "01" }),
    });

    assert.equal(res.status, 401);
  });

  it("parcours complet SOA -> CANA -> clôture via l'API HTTP", async () => {
    const createRes = await fetch(`${baseUrl}/api/admin/new-souls`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${soaToken}`,
      },
      body: JSON.stringify({
        firstName: "Jean",
        lastName: "Kouassi",
        phone: "0700000000",
        gender: "homme",
      }),
    });

    assert.equal(createRes.status, 201);
    const created = (await json(createRes)).data;
    createdIds.push(created._id);
    assert.match(created.caseNumber, /^AN-\d{4}-\d{4}$/);

    // La CANA ne peut pas encore voir ce dossier.
    const tooEarlyRes = await fetch(`${baseUrl}/api/admin/new-souls/${created._id}`, {
      headers: { Authorization: `Bearer ${canaToken}` },
    });
    assert.equal(tooEarlyRes.status, 403);

    const transmitRes = await fetch(
      `${baseUrl}/api/admin/new-souls/${created._id}/transmit`,
      { method: "POST", headers: { Authorization: `Bearer ${soaToken}` } }
    );
    assert.equal(transmitRes.status, 200);
    assert.equal((await json(transmitRes)).data.status, "attente_cana");

    const acknowledgeRes = await fetch(
      `${baseUrl}/api/admin/new-souls/${created._id}/acknowledge`,
      { method: "POST", headers: { Authorization: `Bearer ${canaToken}` } }
    );
    assert.equal(acknowledgeRes.status, 200);

    const patchRes = await fetch(`${baseUrl}/api/admin/new-souls/${created._id}/cana`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${canaToken}`,
      },
      body: JSON.stringify({ flock: flock._id }),
    });
    assert.equal(patchRes.status, 200);

    const closeRes = await fetch(`${baseUrl}/api/admin/new-souls/${created._id}/close`, {
      method: "POST",
      headers: { Authorization: `Bearer ${canaToken}` },
    });
    assert.equal(closeRes.status, 200);
    const closed = (await json(closeRes)).data;
    assert.equal(closed.status, "cloture");
    assert.ok(closed.createdMemberId);

    const member = await Member.findById(closed.createdMemberId).lean();
    assert.equal(member.lastName, "Kouassi");
  });

  it("GET /api/admin/new-souls filtre selon le rôle (le SOA ne voit que ses dossiers)", async () => {
    const createRes = await fetch(`${baseUrl}/api/admin/new-souls`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${soaToken}`,
      },
      body: JSON.stringify({ firstName: "Awa", lastName: "Traore", phone: "0708000000" }),
    });
    const created = (await json(createRes)).data;
    createdIds.push(created._id);

    const listRes = await fetch(`${baseUrl}/api/admin/new-souls`, {
      headers: { Authorization: `Bearer ${soaToken}` },
    });
    const list = (await json(listRes)).data;

    assert.ok(list.some((item) => item._id === created._id));

    // Pas encore transmis : absent de la vue CANA.
    const canaListRes = await fetch(`${baseUrl}/api/admin/new-souls`, {
      headers: { Authorization: `Bearer ${canaToken}` },
    });
    const canaList = (await json(canaListRes)).data;
    assert.ok(!canaList.some((item) => item._id === created._id));
  });

  it("GET /api/admin/new-souls/staff liste les comptes du rôle demandé", async () => {
    const res = await fetch(`${baseUrl}/api/admin/new-souls/staff?role=cana`, {
      headers: { Authorization: `Bearer ${canaToken}` },
    });
    assert.equal(res.status, 200);

    const staff = (await json(res)).data;
    assert.ok(staff.some((item) => item._id === String(canaUserId)));
    assert.ok(!("email" in staff[0]));
  });

  it("GET /api/admin/new-souls/staff refuse un rôle inconnu", async () => {
    const res = await fetch(`${baseUrl}/api/admin/new-souls/staff?role=pasteur-en-chef`, {
      headers: { Authorization: `Bearer ${canaToken}` },
    });
    assert.equal(res.status, 400);
  });

  it("un jeton de session de badgeage des présences (Member) peut aussi créer un dossier", async () => {
    const presenceMember = await Member.create({
      firstName: "Agent",
      lastName: "Présence Route Test",
      church: TEST_CHURCH,
      flock: flock._id,
      registrationNumber: "1AR26097O",
      role: "serviteur",
      status: "actif",
    });

    try {
      const presenceToken = signPresenceSessionToken({
        agent: presenceMember,
        qr: { activatedAt: new Date(), durationMinutes: 60, jti: "test-jti-newsouls" },
      });

      const createRes = await fetch(`${baseUrl}/api/admin/new-souls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${presenceToken}`,
        },
        body: JSON.stringify({ firstName: "Koffi", lastName: "Yao", phone: "0709090909" }),
      });

      assert.equal(createRes.status, 201);
      const created = (await json(createRes)).data;
      createdIds.push(created._id);
      assert.equal(created.createdBy.kind, "member");
      assert.equal(created.soa.agentName, "Agent Présence Route Test");
    } finally {
      await Member.deleteOne({ _id: presenceMember._id });
    }
  });
});
