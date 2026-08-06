import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import User from "../models/User.js";
import * as agentService from "./agent.service.js";

const EMAIL_SUFFIX = "@example.invalid";
const EMAIL_PREFIX = "agent.testsuite";

let createdIds = [];

const cleanup = async () => {
  await User.deleteMany({ _id: { $in: createdIds } });
  createdIds = [];
};

describe("agent.service (intégration MongoDB)", () => {
  before(async () => {
    await connectTestDb();

    await User.deleteMany({ email: { $regex: `${EMAIL_PREFIX}.*${EMAIL_SUFFIX}$` } });
  });

  afterEach(cleanup);

  after(async () => {
    await disconnectTestDb();
  });

  it("crée un agent avec un rôle autorisé et masque le mot de passe", async () => {
    const created = await agentService.create({
      name: "Jean SOA",
      email: `${EMAIL_PREFIX}.create${EMAIL_SUFFIX}`,
      password: "MotDePasseTemporaire123!",
      role: "soa",
    });
    createdIds.push(created.id);

    assert.equal(created.role, "soa");
    assert.equal(created.isActive, true);
    assert.equal(created.password, undefined);

    const stored = await User.findById(created.id).select("+password");
    assert.notEqual(stored.password, "MotDePasseTemporaire123!");
  });

  it("refuse de créer un agent avec un rôle admin/editor", async () => {
    await assert.rejects(
      () =>
        agentService.create({
          name: "Faux Agent",
          email: `${EMAIL_PREFIX}.badrole${EMAIL_SUFFIX}`,
          password: "MotDePasseTemporaire123!",
          role: "admin",
        }),
      /Rôle invalide/
    );
  });

  it("refuse deux agents avec le même e-mail", async () => {
    const first = await agentService.create({
      name: "Premier",
      email: `${EMAIL_PREFIX}.duplicate${EMAIL_SUFFIX}`,
      password: "MotDePasseTemporaire123!",
      role: "cana",
    });
    createdIds.push(first.id);

    await assert.rejects(
      () =>
        agentService.create({
          name: "Second",
          email: `${EMAIL_PREFIX}.duplicate${EMAIL_SUFFIX}`,
          password: "MotDePasseTemporaire123!",
          role: "cana",
        }),
      /existe déjà/
    );
  });

  it("liste uniquement les comptes agents, filtrables par rôle", async () => {
    const soa = await agentService.create({
      name: "Agent Soa Liste",
      email: `${EMAIL_PREFIX}.list-soa${EMAIL_SUFFIX}`,
      password: "MotDePasseTemporaire123!",
      role: "soa",
    });
    const cana = await agentService.create({
      name: "Agent Cana Liste",
      email: `${EMAIL_PREFIX}.list-cana${EMAIL_SUFFIX}`,
      password: "MotDePasseTemporaire123!",
      role: "cana",
    });
    createdIds.push(soa.id, cana.id);

    const all = await agentService.list({ search: "Liste" });
    assert.ok(all.some((item) => item.id === soa.id));
    assert.ok(all.some((item) => item.id === cana.id));

    const onlySoa = await agentService.list({ role: "soa", search: "Liste" });
    assert.ok(onlySoa.some((item) => item.id === soa.id));
    assert.ok(!onlySoa.some((item) => item.id === cana.id));

    const adminAccount = await User.findOne({ role: "admin" }).lean();
    assert.ok(!all.some((item) => item.id === String(adminAccount._id)));
  });

  it("met à jour nom/e-mail/rôle d'un agent, sans jamais permettre le passage à admin/editor", async () => {
    const agent = await agentService.create({
      name: "Avant",
      email: `${EMAIL_PREFIX}.update${EMAIL_SUFFIX}`,
      password: "MotDePasseTemporaire123!",
      role: "soa",
    });
    createdIds.push(agent.id);

    const updated = await agentService.update(agent.id, {
      name: "Après",
      role: "coordinateur_bergeries",
    });
    assert.equal(updated.name, "Après");
    assert.equal(updated.role, "coordinateur_bergeries");

    await assert.rejects(
      () => agentService.update(agent.id, { role: "admin" }),
      /Rôle invalide/
    );
  });

  it("active/désactive un agent", async () => {
    const agent = await agentService.create({
      name: "À désactiver",
      email: `${EMAIL_PREFIX}.status${EMAIL_SUFFIX}`,
      password: "MotDePasseTemporaire123!",
      role: "pasteur",
    });
    createdIds.push(agent.id);

    const deactivated = await agentService.setActive(agent.id, false);
    assert.equal(deactivated.isActive, false);

    const reactivated = await agentService.setActive(agent.id, true);
    assert.equal(reactivated.isActive, true);
  });

  it("réinitialise le mot de passe d'un agent", async () => {
    const agent = await agentService.create({
      name: "Mot de passe oublié",
      email: `${EMAIL_PREFIX}.reset${EMAIL_SUFFIX}`,
      password: "MotDePasseTemporaire123!",
      role: "soa",
    });
    createdIds.push(agent.id);

    await agentService.resetPassword(agent.id, "NouveauMotDePasse456!");

    const stored = await User.findById(agent.id).select("+password");
    const matches = await stored.comparePassword("NouveauMotDePasse456!");
    assert.ok(matches);
  });

  it("supprime un agent, sauf en cas d'auto-suppression", async () => {
    const agent = await agentService.create({
      name: "À supprimer",
      email: `${EMAIL_PREFIX}.delete${EMAIL_SUFFIX}`,
      password: "MotDePasseTemporaire123!",
      role: "cana",
    });
    createdIds.push(agent.id);

    await assert.rejects(
      () => agentService.remove(agent.id, agent.id),
      /propre compte/
    );

    await agentService.remove(agent.id, "000000000000000000000000");
    createdIds = createdIds.filter((id) => id !== agent.id);

    const gone = await User.findById(agent.id);
    assert.equal(gone, null);
  });

  it("ne charge ni ne modifie jamais un compte admin ou editor", async () => {
    const adminAccount = await User.findOne({ role: "admin" }).lean();

    await assert.rejects(
      () => agentService.update(adminAccount._id, { name: "Piraté" }),
      /introuvable/
    );

    await assert.rejects(
      () => agentService.setActive(adminAccount._id, false),
      /introuvable/
    );

    await assert.rejects(
      () => agentService.remove(adminAccount._id, "000000000000000000000000"),
      /introuvable/
    );

    const untouched = await User.findById(adminAccount._id).lean();
    assert.equal(untouched.isActive, adminAccount.isActive);
  });
});
