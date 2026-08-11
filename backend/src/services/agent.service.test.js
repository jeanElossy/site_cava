import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import User from "../models/User.js";
import Member from "../models/Member.js";
import * as agentService from "./agent.service.js";

// Un agent se connecte désormais par matricule (voir User.js), vérifié
// à la création contre un membre réellement enregistré (voir
// agent.service.js#assertMemberExists) — chaque test qui crée un agent
// a donc besoin d'un membre fixture portant un matricule valide.
// Église 5, préfixe de bergerie improbable en production réelle : ces
// membres sont nettoyés par identifiant exact (jamais par un filtre
// large sur l'église), donc sans risque de collision avec les fixtures
// d'un autre fichier de test qui partagerait la même église.
const memberFixture = (sequence) => ({
  firstName: "Fixture",
  lastName: `AgentTest${sequence}`,
  church: 5,
  status: "actif",
  registrationNumber: `5ZZ99${String(sequence).padStart(3, "0")}A`,
});

let memberIds = [];
let createdUserIds = [];

const nextMatricule = (() => {
  let sequence = 0;

  return async () => {
    sequence += 1;

    const member = await Member.create(memberFixture(sequence));
    memberIds.push(member._id);

    return member.registrationNumber;
  };
})();

const cleanupUsers = async () => {
  await User.deleteMany({ _id: { $in: createdUserIds } });
  createdUserIds = [];
};

describe("agent.service (intégration MongoDB)", () => {
  before(async () => {
    await connectTestDb();
  });

  afterEach(cleanupUsers);

  after(async () => {
    await cleanupUsers();
    await Member.deleteMany({ _id: { $in: memberIds } });
    await disconnectTestDb();
  });

  it("crée un agent avec un rôle autorisé et masque le mot de passe", async () => {
    const registrationNumber = await nextMatricule();

    const created = await agentService.create({
      name: "Jean SOA",
      registrationNumber,
      password: "MotDePasseTemporaire123!",
      role: "soa",
    });
    createdUserIds.push(created.id);

    assert.equal(created.role, "soa");
    assert.equal(created.registrationNumber, registrationNumber);
    assert.equal(created.isActive, true);
    assert.equal(created.password, undefined);

    const stored = await User.findById(created.id).select("+password");
    assert.notEqual(stored.password, "MotDePasseTemporaire123!");
  });

  it("crée un agent social", async () => {
    const registrationNumber = await nextMatricule();

    const created = await agentService.create({
      name: "Responsable Service Social",
      registrationNumber,
      password: "MotDePasseTemporaire123!",
      role: "social_admin",
    });
    createdUserIds.push(created.id);

    assert.equal(created.role, "social_admin");
  });

  it("refuse un matricule qui ne correspond à aucun membre", async () => {
    await assert.rejects(
      () =>
        agentService.create({
          name: "Fantôme",
          registrationNumber: "5ZZ99999Z",
          password: "MotDePasseTemporaire123!",
          role: "soa",
        }),
      /Aucun membre trouvé/
    );
  });

  it("refuse de créer un agent avec un rôle admin/editor", async () => {
    await assert.rejects(
      () =>
        agentService.create({
          name: "Faux Agent",
          registrationNumber: "5ZZ99998Z",
          password: "MotDePasseTemporaire123!",
          role: "admin",
        }),
      /Rôle invalide/
    );
  });

  it("refuse deux agents avec le même matricule", async () => {
    const registrationNumber = await nextMatricule();

    const first = await agentService.create({
      name: "Premier",
      registrationNumber,
      password: "MotDePasseTemporaire123!",
      role: "cana",
    });
    createdUserIds.push(first.id);

    await assert.rejects(
      () =>
        agentService.create({
          name: "Second",
          registrationNumber,
          password: "MotDePasseTemporaire123!",
          role: "cana",
        }),
      /existe déjà/
    );
  });

  it("liste uniquement les comptes agents, filtrables par rôle", async () => {
    const soa = await agentService.create({
      name: "Agent Soa Liste",
      registrationNumber: await nextMatricule(),
      password: "MotDePasseTemporaire123!",
      role: "soa",
    });
    const cana = await agentService.create({
      name: "Agent Cana Liste",
      registrationNumber: await nextMatricule(),
      password: "MotDePasseTemporaire123!",
      role: "cana",
    });
    createdUserIds.push(soa.id, cana.id);

    const all = await agentService.list({ search: "Liste" });
    assert.ok(all.some((item) => item.id === soa.id));
    assert.ok(all.some((item) => item.id === cana.id));

    const onlySoa = await agentService.list({ role: "soa", search: "Liste" });
    assert.ok(onlySoa.some((item) => item.id === soa.id));
    assert.ok(!onlySoa.some((item) => item.id === cana.id));

    const adminAccount = await User.findOne({ role: "admin" }).lean();
    assert.ok(!all.some((item) => item.id === String(adminAccount._id)));
  });

  it("met à jour nom/matricule/rôle d'un agent, sans jamais permettre le passage à admin/editor", async () => {
    const agent = await agentService.create({
      name: "Avant",
      registrationNumber: await nextMatricule(),
      password: "MotDePasseTemporaire123!",
      role: "soa",
    });
    createdUserIds.push(agent.id);

    const updated = await agentService.update(agent.id, {
      name: "Après",
      role: "coordinateur_bergeries",
    });
    assert.equal(updated.name, "Après");
    assert.equal(updated.role, "coordinateur_bergeries");

    const newMatricule = await nextMatricule();

    const reMatriculed = await agentService.update(agent.id, {
      registrationNumber: newMatricule,
    });
    assert.equal(reMatriculed.registrationNumber, newMatricule);

    await assert.rejects(
      () => agentService.update(agent.id, { role: "admin" }),
      /Rôle invalide/
    );
  });

  it("active/désactive un agent", async () => {
    const agent = await agentService.create({
      name: "À désactiver",
      registrationNumber: await nextMatricule(),
      password: "MotDePasseTemporaire123!",
      role: "pasteur",
    });
    createdUserIds.push(agent.id);

    const deactivated = await agentService.setActive(agent.id, false);
    assert.equal(deactivated.isActive, false);

    const reactivated = await agentService.setActive(agent.id, true);
    assert.equal(reactivated.isActive, true);
  });

  it("réinitialise le mot de passe d'un agent", async () => {
    const agent = await agentService.create({
      name: "Mot de passe oublié",
      registrationNumber: await nextMatricule(),
      password: "MotDePasseTemporaire123!",
      role: "soa",
    });
    createdUserIds.push(agent.id);

    await agentService.resetPassword(agent.id, "NouveauMotDePasse456!");

    const stored = await User.findById(agent.id).select("+password");
    const matches = await stored.comparePassword("NouveauMotDePasse456!");
    assert.ok(matches);
  });

  it("supprime un agent, sauf en cas d'auto-suppression", async () => {
    const agent = await agentService.create({
      name: "À supprimer",
      registrationNumber: await nextMatricule(),
      password: "MotDePasseTemporaire123!",
      role: "cana",
    });
    createdUserIds.push(agent.id);

    await assert.rejects(
      () => agentService.remove(agent.id, agent.id),
      /propre compte/
    );

    await agentService.remove(agent.id, "000000000000000000000000");
    createdUserIds = createdUserIds.filter((id) => id !== agent.id);

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
