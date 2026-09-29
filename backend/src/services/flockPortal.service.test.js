import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import Flock from "../models/Flock.js";
import Member from "../models/Member.js";
import { resolveFlockAccess } from "./flockAccess.service.js";
import { listMembers, summary } from "./flockPortal.service.js";

// Isolation : préfixe de nom et codes de bergerie propres à cette
// suite — les fichiers de test tournent en parallèle sur la base de
// développement, et nettoyer par un critère large (l'église) ferait
// disparaître les fixtures d'un autre fichier en pleine assertion.
const TEST_LAST_NAME = "TestSuiteFlockPortal";
const CODE_A = "QP";
const CODE_B = "QR";
const CHURCH = 3;

const cleanup = async () => {
  await Flock.deleteMany({ code: { $in: [CODE_A, CODE_B] }, church: CHURCH });
  await Member.deleteMany({ lastName: TEST_LAST_NAME });
};

const makeMember = (firstName, extra = {}) =>
  Member.create({
    firstName,
    lastName: TEST_LAST_NAME,
    church: CHURCH,
    status: "actif",
    ...extra,
  });

describe("flockPortal.service (intégration MongoDB)", () => {
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

  it("ne renvoie QUE les membres de la bergerie du responsable", async () => {
    // La propriété de sécurité du portail. Si elle tombe, le
    // responsable de la bergerie A lit la liste nominative de la B.
    const leader = await makeMember("Responsable");

    const flockA = await Flock.create({
      code: CODE_A,
      name: "Bergerie A de test",
      church: CHURCH,
      leader: leader._id,
    });

    const flockB = await Flock.create({
      code: CODE_B,
      name: "Bergerie B de test",
      church: CHURCH,
    });

    await makeMember("MembreDeA", { flock: flockA._id });
    await makeMember("MembreDeB", { flock: flockB._id });

    const access = await resolveFlockAccess(leader._id);
    const { items, meta } = await listMembers(access);

    assert.deepEqual(
      items.map((m) => m.firstName),
      ["MembreDeA"]
    );
    assert.equal(meta.total, 1);
  });

  it("exclut les membres désactivés", async () => {
    const leader = await makeMember("Responsable");

    const flock = await Flock.create({
      code: CODE_A,
      name: "Bergerie A de test",
      church: CHURCH,
      leader: leader._id,
    });

    await makeMember("Actif", { flock: flock._id });
    await makeMember("Parti", { flock: flock._id, status: "inactif" });

    const { items } = await listMembers(await resolveFlockAccess(leader._id));

    assert.deepEqual(
      items.map((m) => m.firstName),
      ["Actif"]
    );
  });

  it("ne renvoie jamais les notes internes de l'équipe pastorale", async () => {
    // `notes` est `select: false` au modèle, mais la projection du
    // service ne l'y laisse pas reposer : ce qui n'est pas nommé dans
    // MEMBER_FIELDS ne sort pas, quel que soit un réglage lointain.
    const leader = await makeMember("Responsable");

    const flock = await Flock.create({
      code: CODE_A,
      name: "Bergerie A de test",
      church: CHURCH,
      leader: leader._id,
    });

    await makeMember("Suivi", {
      flock: flock._id,
      notes: "Note pastorale confidentielle.",
    });

    const { items } = await listMembers(await resolveFlockAccess(leader._id));

    assert.equal(items.length, 1);
    assert.equal(items[0].notes, undefined);
  });

  it("compte les effectifs de la bergerie dans le résumé", async () => {
    const leader = await makeMember("Responsable");

    const flock = await Flock.create({
      code: CODE_A,
      name: "Bergerie A de test",
      church: CHURCH,
      leader: leader._id,
    });

    await makeMember("Un", { flock: flock._id });
    await makeMember("Deux", { flock: flock._id });
    await makeMember("Parti", { flock: flock._id, status: "inactif" });

    const data = await summary(await resolveFlockAccess(leader._id));

    assert.equal(data.flock.code, CODE_A);
    assert.equal(data.actifs, 2);
    assert.equal(data.inactifs, 1);
  });

  it("ne renvoie rien plutôt que tout quand aucune bergerie n'est accessible", async () => {
    // Le piège que `memberFilterFor` évite : un filtre vide aurait
    // renvoyé TOUS les membres de la base, en silence.
    const flock = await Flock.create({
      code: CODE_A,
      name: "Bergerie A de test",
      church: CHURCH,
    });

    await makeMember("Quelquun", { flock: flock._id });

    const { items, meta } = await listMembers({ flock: null, flockIds: [] });

    assert.deepEqual(items, []);
    assert.equal(meta.total, 0);
  });
});
