import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import Flock from "../models/Flock.js";
import Member from "../models/Member.js";
import {
  resolveFlockAccess,
  memberFilterFor,
} from "./flockAccess.service.js";

// Isolation : préfixe de nom et code de bergerie propres à cette
// suite. Les fichiers de test tournent EN PARALLÈLE sur la base de
// développement — nettoyer par un critère large (l'église, par
// exemple) ferait disparaître les fixtures d'un autre fichier en
// pleine assertion.
const TEST_LAST_NAME = "TestSuiteFlockAccess";
const FLOCK_CODE = "QF";
const CHURCH = 2;

const cleanup = async () => {
  await Flock.deleteMany({ code: FLOCK_CODE, church: CHURCH });
  await Member.deleteMany({ lastName: TEST_LAST_NAME });
};

const makeLeader = () =>
  Member.create({
    firstName: "Responsable",
    lastName: TEST_LAST_NAME,
    church: CHURCH,
    status: "actif",
  });

const makeFlock = (leader, extra = {}) =>
  Flock.create({
    code: FLOCK_CODE,
    name: "Bergerie de test",
    church: CHURCH,
    leader: leader?._id,
    ...extra,
  });

describe("flockAccess.service (intégration MongoDB)", () => {
  before(async () => {
    await connectTestDb();
    await Promise.all([Flock.init(), Member.init()]);
  });

  beforeEach(cleanup);
  afterEach(cleanup);

  after(async () => {
    await cleanup();
    await disconnectTestDb();
  });

  it("ouvre l'accès au responsable actif d'une bergerie publiée", async () => {
    const leader = await makeLeader();
    const flock = await makeFlock(leader);

    const access = await resolveFlockAccess(leader._id);

    assert.equal(access.flock?.code, FLOCK_CODE);
    assert.deepEqual(access.flockIds, [String(flock._id)]);
  });

  it("ferme l'accès quand la désignation est suspendue", async () => {
    // Mise en retrait : la désignation reste, l'accès tombe. C'est ce
    // qui distingue « suspendu » d'un responsable effacé.
    const leader = await makeLeader();

    await makeFlock(leader, { leaderStatus: "suspendu" });

    assert.equal((await resolveFlockAccess(leader._id)).flock, null);
  });

  it("ferme l'accès quand la bergerie n'est pas publiée", async () => {
    for (const status of ["draft", "archived"]) {
      const leader = await makeLeader();

      await makeFlock(leader, { status });

      assert.equal(
        (await resolveFlockAccess(leader._id)).flock,
        null,
        `Une bergerie « ${status} » ne doit ouvrir aucun accès.`
      );

      await cleanup();
    }
  });

  it("ferme l'accès quand le responsable est désactivé de l'annuaire", async () => {
    // Sans cette règle, désactiver quelqu'un de la communauté lui
    // laissait la liste nominative de ses anciens membres.
    const leader = await makeLeader();

    await makeFlock(leader);
    await Member.updateOne({ _id: leader._id }, { status: "inactif" });

    assert.equal((await resolveFlockAccess(leader._id)).flock, null);
  });

  it("ne donne rien à un membre qui ne dirige aucune bergerie", async () => {
    const simple = await makeLeader();

    await makeFlock(null);

    assert.equal((await resolveFlockAccess(simple._id)).flock, null);
  });

  it("refuse un identifiant absent ou mal formé sans lever", async () => {
    for (const value of [null, undefined, "", "pas-un-id"]) {
      const access = await resolveFlockAccess(value);

      assert.equal(access.flock, null);
      assert.deepEqual(access.flockIds, []);
    }
  });

  it("interdit qu'un membre dirige deux bergeries", async () => {
    const leader = await makeLeader();

    await makeFlock(leader);

    await assert.rejects(
      () =>
        Flock.create({
          code: "QG",
          name: "Seconde bergerie de test",
          church: CHURCH,
          leader: leader._id,
        }),
      /duplicate key|E11000/i
    );

    await Flock.deleteMany({ code: "QG", church: CHURCH });
  });
});

describe("flockAccess.service — filtre des membres", () => {
  it("compose un filtre impossible quand aucune bergerie n'est accessible", () => {
    // Un objet VIDE aurait renvoyé tous les membres de l'église, en
    // silence : l'inverse exact de ce qu'on veut.
    assert.deepEqual(memberFilterFor({ flockIds: [] }), { _id: { $in: [] } });
    assert.deepEqual(memberFilterFor({}), { _id: { $in: [] } });
  });

  it("restreint aux bergeries accessibles", () => {
    assert.deepEqual(memberFilterFor({ flockIds: ["a", "b"] }), {
      flock: { $in: ["a", "b"] },
    });
  });
});
