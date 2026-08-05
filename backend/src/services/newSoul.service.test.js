import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import User from "../models/User.js";
import Flock from "../models/Flock.js";
import Member from "../models/Member.js";
import NewSoul from "../models/NewSoul.js";
import * as newSoulService from "./newSoul.service.js";

const FLOCK_CODE = "AN"; // "Âmes Nouvelles" — code de test isolé
const EMAIL_SUFFIX = "@example.invalid";

let soaUser;
let canaUser;
let coordinateurUser;
let pasteurUser;
let adminUser;
let flock;

const asUser = (user) => ({ kind: "user", id: String(user._id), name: user.name, role: user.role });
const asMember = (member) => ({
  kind: "member",
  id: String(member._id),
  name: `${member.firstName} ${member.lastName}`.trim(),
  role: member.role,
});

// Suivi explicite des dossiers créés par CE fichier, plutôt qu'un
// nettoyage par préfixe de numéro de dossier ("AN-") : ce préfixe est
// partagé par TOUS les tests du module (généré par le compteur
// global), donc un `deleteMany` par préfixe supprimait aussi les
// dossiers créés au même instant par newSouls.routes.test.js quand
// les deux fichiers tournent en parallèle (chaque fichier `node --test`
// tourne dans son propre processus, mais tous partagent la même base
// MongoDB de développement — voir test/db.js).
let createdIds = [];

const create = async (data, user) => {
  const result = await newSoulService["create"](data, user);
  createdIds.push(result._id);

  return result;
};

describe("newSoul.service (intégration MongoDB)", () => {
  before(async () => {
    await connectTestDb();
    await Promise.all([Flock.init(), Member.init(), NewSoul.init()]);

    await User.deleteMany({ email: { $regex: `testsuite\\.newsoul.*${EMAIL_SUFFIX}$` } });

    [soaUser, canaUser, coordinateurUser, pasteurUser] = await Promise.all([
      User.create({
        name: "Agent SOA Test",
        email: `soa.testsuite.newsoul${EMAIL_SUFFIX}`,
        password: "MotDePasseTemporaire123!",
        role: "soa",
      }),
      User.create({
        name: "Responsable CANA Test",
        email: `cana.testsuite.newsoul${EMAIL_SUFFIX}`,
        password: "MotDePasseTemporaire123!",
        role: "cana",
      }),
      User.create({
        name: "Coordonnateur Bergeries Test",
        email: `coordinateur.testsuite.newsoul${EMAIL_SUFFIX}`,
        password: "MotDePasseTemporaire123!",
        role: "coordinateur_bergeries",
      }),
      User.create({
        name: "Pasteur Test",
        email: `pasteur.testsuite.newsoul${EMAIL_SUFFIX}`,
        password: "MotDePasseTemporaire123!",
        role: "pasteur",
      }),
    ]);

    adminUser = await User.findOne({ role: "admin" }).lean();
    assert.ok(adminUser, "Un utilisateur admin doit exister en base pour ce test.");

    flock = await Flock.create({
      code: FLOCK_CODE,
      name: "Bergerie Test Nouvelles Âmes",
      church: 1,
    });
  });

  afterEach(async () => {
    await NewSoul.deleteMany({ _id: { $in: createdIds } });
    createdIds = [];
    await Member.deleteMany({ flock: flock._id });
  });

  after(async () => {
    await Flock.deleteOne({ _id: flock._id });
    await User.deleteMany({
      _id: { $in: [soaUser._id, canaUser._id, coordinateurUser._id, pasteurUser._id] },
    });
    await disconnectTestDb();
  });

  it("génère un numéro de dossier au format AN-<année>-XXXX et verrouille l'agent créateur", async () => {
    const newSoul = await create(
      { firstName: "Jean", lastName: "Kouassi", phone: "0700000000" },
      asUser(soaUser)
    );

    assert.match(newSoul.caseNumber, /^AN-\d{4}-\d{4}$/);
    assert.equal(newSoul.status, "enregistre_soa");
    assert.equal(newSoul.createdBy.kind, "user");
    assert.equal(String(newSoul.createdBy.id), String(soaUser._id));
    assert.equal(String(newSoul.soa.agent.id), String(soaUser._id));
    assert.equal(newSoul.soa.agent.name, soaUser.name);
    assert.equal(newSoul.soa.agentName, soaUser.name);
  });

  it("un agent SOA ne voit que ses propres dossiers", async () => {
    const own = await create(
      { firstName: "A", lastName: "B", phone: "01" },
      asUser(soaUser)
    );

    const otherSoa = await User.create({
      name: "Autre Agent SOA",
      email: `soa2.testsuite.newsoul${EMAIL_SUFFIX}`,
      password: "MotDePasseTemporaire123!",
      role: "soa",
    });

    try {
      const notOwned = await create(
        { firstName: "C", lastName: "D", phone: "02" },
        asUser(otherSoa)
      );

      const ownList = await newSoulService.list(asUser(soaUser));
      assert.ok(ownList.some((item) => String(item._id) === String(own._id)));
      assert.ok(!ownList.some((item) => String(item._id) === String(notOwned._id)));

      await assert.rejects(
        () => newSoulService.getById(notOwned._id, asUser(soaUser)),
        /propres dossiers/
      );
    } finally {
      await User.deleteOne({ _id: otherSoa._id });
    }
  });

  it("la CANA ne voit pas un dossier tant qu'il n'est pas transmis", async () => {
    const newSoul = await create(
      { firstName: "Jean", lastName: "Kouassi", phone: "0700000000" },
      asUser(soaUser)
    );

    await assert.rejects(
      () => newSoulService.getById(newSoul._id, asUser(canaUser)),
      /pas encore été transmis/
    );

    const canaList = await newSoulService.list(asUser(canaUser));
    assert.ok(!canaList.some((item) => String(item._id) === String(newSoul._id)));
  });

  it("la transmission exige nom/prénom/téléphone, verrouille la partie SOA et bascule le statut", async () => {
    const incomplete = await create({}, asUser(soaUser));

    await assert.rejects(
      () => newSoulService.transmit(incomplete._id, asUser(soaUser)),
      /indispensables/
    );

    const newSoul = await create(
      { firstName: "Jean", lastName: "Kouassi", phone: "0700000000" },
      asUser(soaUser)
    );

    const transmitted = await newSoulService.transmit(newSoul._id, asUser(soaUser));

    assert.equal(transmitted.status, "attente_cana");
    assert.ok(transmitted.soa.lockedAt);
    assert.ok(transmitted.soa.transmittedAt);

    // Verrouillé : plus aucune modification SOA possible.
    await assert.rejects(
      () => newSoulService.updateSoa(newSoul._id, { firstName: "Autre" }, asUser(soaUser)),
      /plus modifiable/
    );

    // Transmettre deux fois échoue.
    await assert.rejects(
      () => newSoulService.transmit(newSoul._id, asUser(soaUser)),
      /déjà été transmis/
    );
  });

  it("l'accusé de réception CANA préremplit responsable et date, sans écraser un second appel", async () => {
    const newSoul = await create(
      { firstName: "Jean", lastName: "Kouassi", phone: "0700000000" },
      asUser(soaUser)
    );
    await newSoulService.transmit(newSoul._id, asUser(soaUser));

    const acknowledged = await newSoulService.acknowledge(newSoul._id, asUser(canaUser));

    assert.ok(acknowledged.cana.acknowledgedAt);
    assert.equal(String(acknowledged.cana.responsable), String(canaUser._id));

    const firstReceivedAt = acknowledged.cana.receivedAt;

    // Un second appel (ex. admin ouvrant le même dossier) ne doit pas
    // réécraser la date de réception ni le responsable déjà posés.
    const secondCall = await newSoulService.acknowledge(newSoul._id, asUser(canaUser));
    assert.deepEqual(secondCall.cana.receivedAt, firstReceivedAt);
  });

  it("le coordonnateur des bergeries ne peut modifier qu'un sous-ensemble de cana.*", async () => {
    const newSoul = await create(
      { firstName: "Jean", lastName: "Kouassi", phone: "0700000000" },
      asUser(soaUser)
    );
    await newSoulService.transmit(newSoul._id, asUser(soaUser));
    await newSoulService.acknowledge(newSoul._id, asUser(canaUser));

    const updated = await newSoulService.updateCana(
      newSoul._id,
      { monthlyFollowUps: [{ period: "mois_1", objective: "Accueil" }] },
      asUser(coordinateurUser)
    );
    assert.equal(updated.cana.monthlyFollowUps.length, 1);

    await assert.rejects(
      () =>
        newSoulService.updateCana(
          newSoul._id,
          { understandsSalvation: "oui" },
          asUser(coordinateurUser)
        ),
      /ne permet pas de modifier/
    );

    // Le pasteur est en lecture seule.
    await assert.rejects(
      () => newSoulService.updateCana(newSoul._id, { profession: "test" }, asUser(pasteurUser)),
      /lecture seule/
    );
  });

  it("la note confidentielle de délivrance n'est jamais renvoyée à soa ni au coordonnateur", async () => {
    const newSoul = await create(
      { firstName: "Jean", lastName: "Kouassi", phone: "0700000000" },
      asUser(soaUser)
    );
    await newSoulService.transmit(newSoul._id, asUser(soaUser));
    await newSoulService.acknowledge(newSoul._id, asUser(canaUser));

    await newSoulService.updateCana(
      newSoul._id,
      { deliveranceConfidentialNotes: "Détail sensible." },
      asUser(canaUser)
    );

    const seenByCana = await newSoulService.getById(newSoul._id, asUser(canaUser));
    assert.equal(seenByCana.cana.deliveranceConfidentialNotes, "Détail sensible.");

    const seenByCoordinateur = await newSoulService.getById(
      newSoul._id,
      asUser(coordinateurUser)
    );
    assert.equal(seenByCoordinateur.cana.deliveranceConfidentialNotes, undefined);

    const listedByCoordinateur = await newSoulService.list(asUser(coordinateurUser));
    const found = listedByCoordinateur.find((item) => String(item._id) === String(newSoul._id));
    assert.equal(found.cana.deliveranceConfidentialNotes, undefined);
  });

  it("la clôture crée un Member avec matricule et bergerie, sans ressaisie", async () => {
    const newSoul = await create(
      {
        firstName: "Jean",
        lastName: "Kouassi",
        phone: "0700000000",
        gender: "homme",
        waterBaptism: "oui",
        waterBaptismYear: "2010",
      },
      asUser(soaUser)
    );
    await newSoulService.transmit(newSoul._id, asUser(soaUser));
    await newSoulService.acknowledge(newSoul._id, asUser(canaUser));

    await assert.rejects(
      () => newSoulService.close(newSoul._id, asUser(canaUser)),
      /Aucune bergerie/
    );

    await newSoulService.updateCana(newSoul._id, { flock: flock._id }, asUser(canaUser));

    const closed = await newSoulService.close(newSoul._id, asUser(canaUser));

    assert.equal(closed.status, "cloture");
    assert.ok(closed.createdMemberId);

    const member = await Member.findById(closed.createdMemberId).lean();
    assert.equal(member.firstName, "Jean");
    assert.equal(member.lastName, "Kouassi");
    assert.equal(member.church, flock.church);
    assert.equal(String(member.flock), String(flock._id));
    assert.match(member.registrationNumber, /^1AN\d{5}[A-Z]$/);
    assert.equal(member.baptism.water, true);
    assert.equal(member.baptism.waterYear, 2010);

    // Clôturer deux fois échoue.
    await assert.rejects(() => newSoulService.close(newSoul._id, asUser(canaUser)), /déjà clôturé/);
  });

  it("changement de statut : réservé au camp CANA, jamais vers un statut SOA", async () => {
    const newSoul = await create(
      { firstName: "Jean", lastName: "Kouassi", phone: "0700000000" },
      asUser(soaUser)
    );

    await assert.rejects(
      () => newSoulService.updateStatus(newSoul._id, "premier_contact", asUser(soaUser)),
      /ne permet pas/
    );

    await newSoulService.transmit(newSoul._id, asUser(soaUser));

    const updated = await newSoulService.updateStatus(
      newSoul._id,
      "premier_contact",
      asUser(canaUser)
    );
    assert.equal(updated.status, "premier_contact");
    assert.equal(updated.statusHistory.at(-1).status, "premier_contact");

    await assert.rejects(
      () => newSoulService.updateStatus(newSoul._id, "enregistre_soa", asUser(canaUser)),
      /invalide/
    );
  });

  it("un agent de badgeage des présences (Member) a les mêmes droits qu'un SOA sur ses propres dossiers", async () => {
    const presenceMember = await Member.create({
      firstName: "Agent",
      lastName: "Présence Test",
      church: 1,
      flock: flock._id,
      registrationNumber: "1AN26098P",
      role: "serviteur",
      status: "actif",
    });

    try {
      const actor = asMember(presenceMember);

      const newSoul = await create(
        { firstName: "Koffi", lastName: "Yao", phone: "0709090909" },
        actor
      );

      assert.equal(newSoul.createdBy.kind, "member");
      assert.equal(newSoul.soa.agentName, actor.name);

      // Un compte admin User ne peut pas se faire passer pour ce
      // dossier via l'ancienne comparaison (kind différent).
      await assert.rejects(
        () => newSoulService.getById(newSoul._id, asUser(soaUser)),
        /propres dossiers/
      );

      const transmitted = await newSoulService.transmit(newSoul._id, actor);
      assert.equal(transmitted.status, "attente_cana");

      const list = await newSoulService.list(actor);
      assert.ok(list.some((item) => String(item._id) === String(newSoul._id)));
    } finally {
      await Member.deleteOne({ _id: presenceMember._id });
    }
  });
});
