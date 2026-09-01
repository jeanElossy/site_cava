import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import { signToken } from "../middlewares/auth.js";
import User from "../models/User.js";
import SocialFundSettings from "../models/SocialFundSettings.js";
import SocialContribution from "../models/SocialContribution.js";
import SocialLedgerEntry from "../models/SocialLedgerEntry.js";
import SocialAid from "../models/SocialAid.js";
import SocialFundYear from "../models/SocialFundYear.js";
import SocialAidType from "../models/SocialAidType.js";
import Member from "../models/Member.js";

const { createApp } = await import("../app.js");

// Église 2, et surtout PAS la 5 : voir l'écart assumé documenté en tête
// de socialContribution.service.test.js — Member.church rejette 9, une
// église réelle est donc indispensable.
//
// Pourquoi pas la 5, que ce fichier utilisait : `SocialFundSettings`
// porte un index UNIQUE sur `church`, et socialContribution.service.test.js
// y crée déjà les siens. Deux fichiers `node --test` s'exécutant en
// parallèle sur la MÊME base (voir CLAUDE.md), le second à démarrer
// échouait sur une clé dupliquée ou effaçait les réglages du premier.
// L'église 5 est par ailleurs la plus encombrée du dépôt (Flock, agents,
// nouvelles âmes). L'église 2 n'est utilisée que par
// submission.service.test.js, qui nettoie proprement par marqueur.
const TEST_CHURCH = 2;

const EMAIL_SUFFIX = "@example.invalid";
const EMAIL_PREFIX = "social.testsuite.routes";
const AID_TYPE_NAME_PREFIX = "Test Route Aide Sociale";

// Préfixe porté par les seuls membres créés ICI. Le nettoyage vise ce
// marqueur et jamais l'église entière : un `deleteMany({ church })`
// emporte les fixtures d'un autre fichier en plein vol — c'est
// exactement ce qui s'est produit, agent.service.test.js perdant ses
// membres au milieu de ses assertions (voir CLAUDE.md, section Tests).
const MEMBER_PREFIX = "RouteSocial";

// Nettoyage CIBLÉ, partagé par `before` et `after`.
//
// Les cotisations, aides et mouvements sont retrouvés par les membres
// de ce fichier, jamais par l'église : un autre fichier de test peut
// travailler sur la même au même instant.
//
// `SocialFundSettings` et `SocialFundYear` restent nettoyés par église,
// et c'est volontaire — ils sont uniques par église, et l'église 2 est
// désormais réservée à ce fichier (voir TEST_CHURCH plus haut).
const cleanupFixtures = async () => {
  const mine = await Member.find({
    church: TEST_CHURCH,
    lastName: new RegExp(`^${MEMBER_PREFIX}`),
  })
    .select("_id")
    .lean();

  const ids = mine.map((member) => member._id);

  await SocialContribution.deleteMany({ member: { $in: ids } });
  await SocialAid.deleteMany({ member: { $in: ids } });

  // Le journal ne porte pas de référence au membre : son libellé, lui,
  // reprend le nom — donc le marqueur (voir recordLedgerEntry).
  await SocialLedgerEntry.deleteMany({
    church: TEST_CHURCH,
    description: new RegExp(MEMBER_PREFIX),
  });

  await Member.deleteMany({ _id: { $in: ids } });

  await SocialFundSettings.deleteMany({ church: TEST_CHURCH });
  await SocialFundYear.deleteMany({ church: TEST_CHURCH });

  await SocialAidType.deleteMany({
    name: { $regex: `^${AID_TYPE_NAME_PREFIX}` },
  });
};

let server;
let baseUrl;

let viewerUser;
let viewerToken;
let agentUser;
let agentToken;
let approverUser;
let approverToken;
let aidType;

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
    await cleanupFixtures();

    viewerUser = await User.create({
      name: "Viewer Test Service Social",
      email: `${EMAIL_PREFIX}.viewer${EMAIL_SUFFIX}`,
      registrationNumber: "2AA00701Y",
      password: "MotDePasseTemporaire123!",
      role: "social_viewer",
    });
    viewerToken = signToken({ _id: viewerUser._id, role: "social_viewer" });

    agentUser = await User.create({
      name: "Agent Test Service Social",
      email: `${EMAIL_PREFIX}.agent${EMAIL_SUFFIX}`,
      registrationNumber: "2AA00702Z",
      password: "MotDePasseTemporaire123!",
      role: "social_agent",
    });
    agentToken = signToken({ _id: agentUser._id, role: "social_agent" });

    approverUser = await User.create({
      name: "Approver Test Service Social",
      email: `${EMAIL_PREFIX}.approver${EMAIL_SUFFIX}`,
      registrationNumber: "2AA00703A",
      password: "MotDePasseTemporaire123!",
      role: "social_approver",
    });
    approverToken = signToken({ _id: approverUser._id, role: "social_approver" });

    // openingBalance: 0, comme en Phase 1 — INCHANGÉ volontairement.
    // socialContribution.service.test.js (fichier `node --test` séparé,
    // donc processus concurrent — voir test/db.js) affirme
    // `caisse.openingBalance === 0` sur cette même église 5 : une
    // valeur différente ici casserait cette assertion en cas de course
    // entre les deux `before()`. Le test de validation d'aide plus bas
    // se contente donc du solde déjà apporté par le test de paiement
    // de cotisation qui le précède dans ce même fichier (1000, ajouté
    // séquentiellement puisque les tests d'un même describe s'exécutent
    // dans l'ordre — voir la note plus bas sur le montant choisi).
    await SocialFundSettings.create({
      church: TEST_CHURCH,
      monthlyContributionAmount: 1000,
      openingBalance: 0,
    });

    aidType = await SocialAidType.create({
      name: `${AID_TYPE_NAME_PREFIX} ${Math.random().toString(36).slice(2, 8)}`,
      active: true,
    });

    const app = createApp();
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await cleanupFixtures();
    await User.deleteMany({
      _id: { $in: [viewerUser._id, agentUser._id, approverUser._id] },
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
      lastName: `${MEMBER_PREFIX} TestSocial`,
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

  // ---- Aides sociales (Phase 2) -----------------------------------

  it("social_viewer reçoit 403 sur POST /aids", async () => {
    const member = await Member.create({
      firstName: "Route",
      lastName: `${MEMBER_PREFIX} AideViewer`,
      church: TEST_CHURCH,
      status: "actif",
    });

    const res = await fetch(`${baseUrl}/api/admin/social/aids`, authed(viewerToken, {
      method: "POST",
      body: JSON.stringify({
        memberId: String(member._id),
        aidTypeId: String(aidType._id),
        amount: 1000,
        motif: "Test",
      }),
    }));

    assert.equal(res.status, 403);
  });

  it("social_viewer reçoit 403 sur PATCH .../valider", async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();

    const res = await fetch(
      `${baseUrl}/api/admin/social/aids/${fakeId}/valider`,
      authed(viewerToken, { method: "PATCH" })
    );

    assert.equal(res.status, 403);
  });

  it("social_agent peut créer une demande d'aide", async () => {
    const member = await Member.create({
      firstName: "Route",
      lastName: `${MEMBER_PREFIX} AideAgent`,
      church: TEST_CHURCH,
      status: "actif",
    });

    const res = await fetch(`${baseUrl}/api/admin/social/aids`, authed(agentToken, {
      method: "POST",
      body: JSON.stringify({
        memberId: String(member._id),
        aidTypeId: String(aidType._id),
        amount: 1000,
        motif: "Frais médicaux",
      }),
    }));

    assert.equal(res.status, 201);

    const body = await json(res);
    assert.equal(body.data.status, "en_attente");
  });

  it("social_agent reçoit 403 sur PATCH .../valider (pas dans SOCIAL_DECISION_ROLES)", async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();

    const res = await fetch(
      `${baseUrl}/api/admin/social/aids/${fakeId}/valider`,
      authed(agentToken, { method: "PATCH" })
    );

    assert.equal(res.status, 403);
  });

  it("social_agent reçoit 403 sur PATCH .../annuler", async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();

    const res = await fetch(
      `${baseUrl}/api/admin/social/aids/${fakeId}/annuler`,
      authed(agentToken, {
        method: "PATCH",
        body: JSON.stringify({ motif: "Test" }),
      })
    );

    assert.equal(res.status, 403);
  });

  it("social_approver peut valider une aide en attente (décision, pas d'écriture)", async () => {
    const member = await Member.create({
      firstName: "Route",
      lastName: `${MEMBER_PREFIX} AideApprover`,
      church: TEST_CHURCH,
      status: "actif",
    });

    // Montant volontairement modeste (200) : la caisse de l'église 5
    // n'a été alimentée que par le test de paiement de cotisation
    // ci-dessus (1000, openingBalance restant à 0 — voir la note sur
    // ce choix dans le `before()`), et cette église est partagée avec
    // socialContribution.service.test.js dans un processus concurrent.
    const createRes = await fetch(`${baseUrl}/api/admin/social/aids`, authed(agentToken, {
      method: "POST",
      body: JSON.stringify({
        memberId: String(member._id),
        aidTypeId: String(aidType._id),
        amount: 200,
        motif: "À valider",
      }),
    }));
    const created = await json(createRes);

    const validateRes = await fetch(
      `${baseUrl}/api/admin/social/aids/${created.data._id}/valider`,
      authed(approverToken, { method: "PATCH" })
    );

    assert.equal(validateRes.status, 200);

    const validated = await json(validateRes);
    assert.equal(validated.data.status, "payee");
    assert.match(validated.data.reference, /^AIDE-\d{4}-\d{5}$/);
  });
});
