import { describe, it, before, after, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import webpush from "web-push";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import User from "../models/User.js";
import Flock from "../models/Flock.js";
import Member from "../models/Member.js";
import NewSoul from "../models/NewSoul.js";
import PushSubscription from "../models/PushSubscription.js";
import RegistrationCounter from "../models/RegistrationCounter.js";
import * as newSoulService from "./newSoul.service.js";
import * as pushService from "./push.service.js";

const FLOCK_CODE = "AN"; // "Âmes Nouvelles" — code de test isolé
const EMAIL_SUFFIX = "@example.invalid";
// Église FICTIVE (jamais l'église réelle 1) : la clôture d'un dossier
// crée un Member via `nextRegistrationNumber`, qui incrémente le
// compteur RÉEL de l'église concernée. Utiliser l'église 1 ici a fait
// dériver le compteur réel de +3 à chaque exécution de la suite
// (aucune libération en `afterEach`/`after`), gonflant en production le
// numéro de plusieurs membres réels bien au-delà du dernier matricule
// réellement attribué. Voir le nettoyage du compteur en fin de fichier.
const TEST_CHURCH = 4;

let soaUser;
let canaUser;
let coordinateurUser;
let pasteurUser;
let adminUser;
let flock;

// `create`/`transmit` déclenchent volontairement une notification push
// SANS l'attendre (voir newSoul.service.js#notifyNewDossier — elle ne
// doit jamais retarder la réponse HTTP) : dans les tests qui vérifient
// cet envoi, il faut donc laisser une chance à la chaîne asynchrone en
// arrière-plan de s'exécuter avant d'inspecter le mock, plutôt que de
// l'observer juste après le `await` de l'action principale.
const waitFor = async (predicate, { timeout = 1000, interval = 20 } = {}) => {
  const deadline = Date.now() + timeout;

  while (!predicate()) {
    if (Date.now() >= deadline) return;

    await new Promise((resolve) => setTimeout(resolve, interval));
  }
};

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
        registrationNumber: "5AA00201S",
        password: "MotDePasseTemporaire123!",
        role: "soa",
      }),
      User.create({
        name: "Responsable CANA Test",
        email: `cana.testsuite.newsoul${EMAIL_SUFFIX}`,
        registrationNumber: "5AA00202T",
        password: "MotDePasseTemporaire123!",
        role: "cana",
      }),
      User.create({
        name: "Coordonnateur Bergeries Test",
        email: `coordinateur.testsuite.newsoul${EMAIL_SUFFIX}`,
        registrationNumber: "5AA00203U",
        password: "MotDePasseTemporaire123!",
        role: "coordinateur_bergeries",
      }),
      User.create({
        name: "Pasteur Test",
        email: `pasteur.testsuite.newsoul${EMAIL_SUFFIX}`,
        registrationNumber: "5AA00204V",
        password: "MotDePasseTemporaire123!",
        role: "pasteur",
      }),
    ]);

    adminUser = await User.findOne({ role: "admin" }).lean();
    assert.ok(adminUser, "Un utilisateur admin doit exister en base pour ce test.");

    flock = await Flock.create({
      code: FLOCK_CODE,
      name: "Bergerie Test Nouvelles Âmes",
      church: TEST_CHURCH,
    });
  });

  afterEach(async () => {
    await NewSoul.deleteMany({ _id: { $in: createdIds } });
    createdIds = [];
    await Member.deleteMany({ flock: flock._id });
    mock.restoreAll();
  });

  after(async () => {
    await Flock.deleteOne({ _id: flock._id });
    await User.deleteMany({
      _id: { $in: [soaUser._id, canaUser._id, coordinateurUser._id, pasteurUser._id] },
    });
    // Église fictive, jamais réelle : purge sans condition, aucune
    // valeur "d'avant le test" à préserver.
    await RegistrationCounter.deleteOne({ church: TEST_CHURCH });
    await disconnectTestDb();
  });

  it("génère un numéro de dossier au format AN-<année>-XXX et verrouille l'agent créateur", async () => {
    const newSoul = await create(
      { firstName: "Jean", lastName: "Kouassi", phone: "0700000000" },
      asUser(soaUser)
    );

    assert.match(newSoul.caseNumber, /^AN-\d{4}-\d{3,}$/);
    assert.equal(newSoul.status, "enregistre_soa");
    assert.equal(newSoul.createdBy.kind, "user");
    assert.equal(String(newSoul.createdBy.id), String(soaUser._id));
    assert.equal(String(newSoul.soa.agent.id), String(soaUser._id));
    assert.equal(newSoul.soa.agent.name, soaUser.name);
    assert.equal(newSoul.soa.agentName, soaUser.name);
  });

  it("tous les comptes SOA partagent la même file de dossiers non transmis", async () => {
    const own = await create(
      { firstName: "A", lastName: "B", phone: "01" },
      asUser(soaUser)
    );

    const otherSoa = await User.create({
      name: "Autre Agent SOA",
      email: `soa2.testsuite.newsoul${EMAIL_SUFFIX}`,
      registrationNumber: "5AA00205W",
      password: "MotDePasseTemporaire123!",
      role: "soa",
    });

    try {
      const createdByOther = await create(
        { firstName: "C", lastName: "D", phone: "02" },
        asUser(otherSoa)
      );

      // Un compte SOA voit la file complète des dossiers non transmis,
      // y compris ceux ouverts par un autre agent SOA — pas seulement
      // les siens : c'est ce qui permet à n'importe quel agent SOA de
      // reprendre un dossier démarré par quelqu'un d'autre (ex. un
      // agent de badgeage des présences, voir le test suivant).
      const list = await newSoulService.list(asUser(soaUser));
      assert.ok(list.some((item) => String(item._id) === String(own._id)));
      assert.ok(list.some((item) => String(item._id) === String(createdByOther._id)));

      const fetched = await newSoulService.getById(createdByOther._id, asUser(soaUser));
      assert.equal(String(fetched._id), String(createdByOther._id));

      // Transmis, le dossier sort de la file SOA (repris par la CANA) :
      // un compte SOA ne le voit plus, même s'il l'a créé.
      const transmitted = await newSoulService.transmit(createdByOther._id, asUser(otherSoa));
      assert.equal(transmitted.status, "attente_cana");

      const listAfterTransmit = await newSoulService.list(asUser(soaUser));
      assert.ok(!listAfterTransmit.some((item) => String(item._id) === String(createdByOther._id)));

      await assert.rejects(
        () => newSoulService.getById(createdByOther._id, asUser(soaUser)),
        /déjà été transmis/
      );
    } finally {
      await User.deleteOne({ _id: otherSoa._id });
    }
  });

  it("un agent de badgeage des présences ne voit que les dossiers qu'il a lui-même créés, même si un compte SOA voit tout", async () => {
    const presenceMember = await Member.create({
      firstName: "Agent",
      lastName: "Présence Visibilité",
      church: TEST_CHURCH,
      flock: flock._id,
      registrationNumber: "1AN26099U",
      role: "serviteur",
      status: "actif",
    });

    try {
      const actor = asMember(presenceMember);
      const createdByMember = await create(
        { firstName: "Koffi", lastName: "Yao", phone: "0709090910" },
        actor
      );

      const otherMember = await Member.create({
        firstName: "Autre",
        lastName: "Agent Présence",
        church: TEST_CHURCH,
        flock: flock._id,
        registrationNumber: "1AN26100V",
        role: "serviteur",
        status: "actif",
      });

      try {
        await assert.rejects(
          () => newSoulService.getById(createdByMember._id, asMember(otherMember)),
          /propres dossiers/
        );

        const otherMemberList = await newSoulService.list(asMember(otherMember));
        assert.ok(!otherMemberList.some((item) => String(item._id) === String(createdByMember._id)));
      } finally {
        await Member.deleteOne({ _id: otherMember._id });
      }

      // Contrairement à un autre agent de présence, N'IMPORTE QUEL
      // compte SOA voit et peut compléter ce dossier — c'est la "porte
      // d'entrée" attendue : l'agent de présence démarre le dossier,
      // un agent SOA se connecte ensuite pour le reprendre.
      const seenBySoa = await newSoulService.getById(createdByMember._id, asUser(soaUser));
      assert.equal(String(seenBySoa._id), String(createdByMember._id));

      const soaList = await newSoulService.list(asUser(soaUser));
      assert.ok(soaList.some((item) => String(item._id) === String(createdByMember._id)));

      const updated = await newSoulService.updateSoa(
        createdByMember._id,
        { phone: "0709090999" },
        asUser(soaUser)
      );
      assert.equal(updated.soa.phone, "0709090999");
    } finally {
      await Member.deleteOne({ _id: presenceMember._id });
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
    assert.match(member.registrationNumber, new RegExp(`^${TEST_CHURCH}AN\\d{5}[A-Z]$`));
    assert.equal(member.baptism.water, true);
    assert.equal(member.baptism.waterYear, 2010);

    // Clôturer deux fois échoue.
    await assert.rejects(() => newSoulService.close(newSoul._id, asUser(canaUser)), /déjà clôturé/);
  });

  it("le millésime du matricule et joinedAt suivent la première visite (§A), pas la date de clôture", async () => {
    const newSoul = await create(
      {
        firstName: "Awa",
        lastName: "Traoré",
        phone: "0700000001",
        gender: "femme",
        // Premier contact il y a plusieurs années : un dossier peut être
        // clôturé bien après, la clôture ne doit pas dater le matricule
        // ni `joinedAt` du jour du traitement.
        firstVisitAt: new Date(Date.UTC(2022, 5, 15)),
      },
      asUser(soaUser)
    );
    await newSoulService.transmit(newSoul._id, asUser(soaUser));
    await newSoulService.acknowledge(newSoul._id, asUser(canaUser));
    await newSoulService.updateCana(newSoul._id, { flock: flock._id }, asUser(canaUser));

    const closed = await newSoulService.close(newSoul._id, asUser(canaUser));
    const member = await Member.findById(closed.createdMemberId).lean();

    assert.match(member.registrationNumber, new RegExp(`^${TEST_CHURCH}AN22\\d{3}[A-Z]$`));
    assert.equal(new Date(member.joinedAt).getUTCFullYear(), 2022);
  });

  it("archive puis reprend un dossier côté SOA, sans changer son statut", async () => {
    const newSoul = await create(
      { firstName: "Jean", lastName: "Kouassi", phone: "0700000000" },
      asUser(soaUser)
    );

    const archived = await newSoulService.archive(newSoul._id, asUser(soaUser), "Ne répond plus");

    assert.ok(archived.archivedAt);
    assert.equal(archived.archivedBy.name, soaUser.name);
    assert.equal(archived.archiveReason, "Ne répond plus");
    // Le statut du parcours ne bouge pas : archiver n'est qu'une pause.
    assert.equal(archived.status, "enregistre_soa");

    const resumed = await newSoulService.unarchive(newSoul._id, asUser(soaUser));

    assert.equal(resumed.archivedAt, undefined);
    assert.equal(resumed.archivedBy, undefined);
    assert.equal(resumed.status, "enregistre_soa");
  });

  it("archive puis reprend un dossier côté CANA, réservé à qui pourrait déjà le modifier", async () => {
    const newSoul = await create(
      { firstName: "Jean", lastName: "Kouassi", phone: "0700000000" },
      asUser(soaUser)
    );
    await newSoulService.transmit(newSoul._id, asUser(soaUser));

    // Le SOA ne peut plus toucher ce dossier une fois transmis, y
    // compris pour l'archiver.
    await assert.rejects(
      () => newSoulService.archive(newSoul._id, asUser(soaUser)),
      /ne permet pas/
    );

    // Le pasteur reste en lecture seule sur le module CANA, y compris
    // pour l'archivage.
    await assert.rejects(
      () => newSoulService.archive(newSoul._id, asUser(pasteurUser)),
      /ne permet pas/
    );

    const archived = await newSoulService.archive(newSoul._id, asUser(canaUser));
    assert.ok(archived.archivedAt);

    await assert.rejects(
      () => newSoulService.archive(newSoul._id, asUser(canaUser)),
      /déjà archivé/
    );

    const resumed = await newSoulService.unarchive(newSoul._id, asUser(coordinateurUser));
    assert.equal(resumed.archivedAt, undefined);

    await assert.rejects(
      () => newSoulService.unarchive(newSoul._id, asUser(coordinateurUser)),
      /n'est pas archivé/
    );
  });

  it("exclut un dossier archivé de la liste par défaut et des stats SOA en attente", async () => {
    const newSoul = await create(
      { firstName: "Jean", lastName: "Kouassi", phone: "0700000000" },
      asUser(soaUser)
    );

    const statsWithDossier = await newSoulService.getStats(asUser(soaUser));

    await newSoulService.archive(newSoul._id, asUser(soaUser));

    const activeList = await newSoulService.list(asUser(soaUser));
    assert.equal(
      activeList.some((item) => String(item._id) === String(newSoul._id)),
      false
    );

    const archivedList = await newSoulService.list(asUser(soaUser), { archived: true });
    assert.equal(
      archivedList.some((item) => String(item._id) === String(newSoul._id)),
      true
    );

    const statsAfterArchive = await newSoulService.getStats(asUser(soaUser));

    // Comparaison RELATIVE, pas une valeur absolue : la base de test
    // est partagée entre fichiers exécutés en parallèle (voir le
    // commentaire en tête de ce fichier) — seule la variation
    // attribuable à CE dossier est fiable à vérifier ici.
    assert.equal(statsAfterArchive.soaPending, statsWithDossier.soaPending - 1);
  });

  it("refuse d'archiver un dossier déjà clôturé", async () => {
    const newSoul = await create(
      {
        firstName: "Jean",
        lastName: "Kouassi",
        phone: "0700000000",
        gender: "homme",
      },
      asUser(soaUser)
    );

    await newSoulService.transmit(newSoul._id, asUser(soaUser));
    await newSoulService.acknowledge(newSoul._id, asUser(canaUser));
    await newSoulService.updateCana(newSoul._id, { flock: flock._id }, asUser(canaUser));

    const closed = await newSoulService.close(newSoul._id, asUser(canaUser));
    assert.equal(closed.status, "cloture");

    await assert.rejects(
      () => newSoulService.archive(newSoul._id, asUser(canaUser)),
      /déjà clôturé/
    );
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
      church: TEST_CHURCH,
      flock: flock._id,
      registrationNumber: "1AN26098T",
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

      // Un compte SOA (kind différent du créateur) fait bien partie de
      // la file partagée : il voit ce dossier malgré tout (voir le
      // test dédié plus haut sur le partage de file SOA/présence).
      const seenBySoa = await newSoulService.getById(newSoul._id, asUser(soaUser));
      assert.equal(String(seenBySoa._id), String(newSoul._id));

      const transmitted = await newSoulService.transmit(newSoul._id, actor);
      assert.equal(transmitted.status, "attente_cana");

      const list = await newSoulService.list(actor);
      assert.ok(list.some((item) => String(item._id) === String(newSoul._id)));
    } finally {
      await Member.deleteOne({ _id: presenceMember._id });
    }
  });

  it("un statut explicite ne permet pas à la CANA de voir un dossier non transmis", async () => {
    const notTransmitted = await create(
      { firstName: "Jean", lastName: "Kouassi", phone: "0700000000" },
      asUser(soaUser)
    );

    // Avant le correctif, `list({ status: "enregistre_soa" })` écrasait
    // le `$nin` de visibilité de la CANA et renvoyait ce dossier.
    await assert.rejects(
      () => newSoulService.list(asUser(canaUser), { status: "enregistre_soa" }),
      /non encore transmis/
    );

    // Un statut côté CANA reste, lui, autorisé et filtre correctement.
    const transmitted = await create(
      { firstName: "Awa", lastName: "Diallo", phone: "0711111111" },
      asUser(soaUser)
    );
    await newSoulService.transmit(transmitted._id, asUser(soaUser));

    const filtered = await newSoulService.list(asUser(canaUser), { status: "attente_cana" });
    assert.ok(filtered.some((item) => String(item._id) === String(transmitted._id)));
    assert.ok(!filtered.some((item) => String(item._id) === String(notTransmitted._id)));
  });

  it("un compte admin peut filtrer par un statut SOA, contrairement à la CANA (isCanaSideUser inclut admin)", async () => {
    const newSoul = await create(
      { firstName: "Jean", lastName: "Kouassi", phone: "0700000000" },
      asUser(soaUser)
    );

    const filtered = await newSoulService.list(asUser(adminUser), { status: "enregistre_soa" });

    assert.ok(filtered.some((item) => String(item._id) === String(newSoul._id)));
  });

  it("getStats compte les dossiers par statut et liste les suivis mensuels à venir, dans le périmètre de visibilité de l'acteur", async () => {
    const ownedBySoa = await create(
      { firstName: "Jean", lastName: "Kouassi", phone: "0700000000" },
      asUser(soaUser)
    );

    const transmitted = await create(
      { firstName: "Awa", lastName: "Diallo", phone: "0711111111" },
      asUser(soaUser)
    );
    await newSoulService.transmit(transmitted._id, asUser(soaUser));
    await newSoulService.acknowledge(transmitted._id, asUser(canaUser));

    const inOneWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await newSoulService.updateCana(
      transmitted._id,
      { monthlyFollowUps: [{ period: "mois_1", objective: "Accueil", reviewDate: inOneWeek }] },
      asUser(canaUser)
    );

    const soaStats = await newSoulService.getStats(asUser(soaUser));
    assert.ok(soaStats.byStatus.enregistre_soa >= 1);
    // Une fois transmis, un dossier sort de la file SOA (repris par la
    // CANA) : son suivi mensuel n'apparaît plus dans les stats SOA,
    // même pour l'agent qui l'a lui-même transmis.
    assert.ok(!soaStats.upcomingFollowUps.some((item) => String(item.newSoulId) === String(transmitted._id)));

    const canaStats = await newSoulService.getStats(asUser(canaUser));
    assert.equal(canaStats.byStatus.enregistre_soa, 0, "la CANA ne compte pas les dossiers non transmis");
    assert.ok(canaStats.canaActive >= 1);
    assert.ok(canaStats.upcomingFollowUps.some((item) => String(item.newSoulId) === String(transmitted._id)));
    assert.ok(!canaStats.upcomingFollowUps.some((item) => String(item.newSoulId) === String(ownedBySoa._id)));

    // `transmitted` est déjà accusé réception (ligne plus haut) : il
    // ne doit pas compter dans "à traiter". Un second dossier,
    // transmis mais jamais ouvert par la CANA, doit lui y figurer.
    const notAcknowledged = await create(
      { firstName: "Koffi", lastName: "N'Guessan", phone: "0722222222" },
      asUser(soaUser)
    );
    await newSoulService.transmit(notAcknowledged._id, asUser(soaUser));

    const canaStatsAfter = await newSoulService.getStats(asUser(canaUser));
    assert.ok(canaStatsAfter.awaitingAcknowledgement >= 1);

    await newSoulService.acknowledge(notAcknowledged._id, asUser(canaUser));

    const canaStatsAcknowledged = await newSoulService.getStats(asUser(canaUser));
    assert.equal(
      canaStatsAcknowledged.awaitingAcknowledgement,
      canaStatsAfter.awaitingAcknowledgement - 1
    );
  });

  // Les deux tests suivants mockent `webpush.sendNotification` (export
  // CJS de la bibliothèque, donc reconfigurable) plutôt que les
  // fonctions exportées de push.service.js : ce module natif ESM
  // expose des liaisons non reconfigurables, que `mock.method` ne peut
  // pas remplacer (`Cannot redefine property`). Passer par l'envoi réel
  // vérifie en plus tout le chemin (acteur → rôles → abonnés → appel),
  // pas seulement que la fonction est invoquée.
  it("notifie l'équipe SOA quand un agent de présence crée un dossier, mais pas quand un compte SOA crée le sien", async () => {
    const sendNotification = mock.method(webpush, "sendNotification", async () => {});
    const endpoint = "https://push.example.invalid/newsoul-test-soa";

    await pushService.subscribe(soaUser._id, {
      endpoint,
      keys: { p256dh: "p256dh", auth: "auth" },
    });

    const presenceMember = await Member.create({
      firstName: "Agent",
      lastName: "Présence Notif",
      church: TEST_CHURCH,
      flock: flock._id,
      registrationNumber: "1AN26101W",
      role: "serviteur",
      status: "actif",
    });

    try {
      await create(
        { firstName: "Aya", lastName: "Kone", phone: "0733333333" },
        asMember(presenceMember)
      );

      await waitFor(() =>
        sendNotification.mock.calls.some((call) => call.arguments[0].endpoint === endpoint)
      );

      // `sendToRoles` interroge tous les comptes "soa" actifs de toute
      // la base, pas seulement ceux de ce test : sur la base de dev
      // partagée, un autre fichier de test exécuté en parallèle peut
      // ajouter d'autres appels au même instant (voir le commentaire
      // équivalent dans push.service.test.js) — d'où une recherche du
      // NOTRE appel plutôt qu'un `callCount()` exact.
      const ourCall = sendNotification.mock.calls.find(
        (call) => call.arguments[0].endpoint === endpoint
      );
      assert.ok(ourCall, "aucun envoi vers notre abonnement SOA");
      assert.match(JSON.parse(ourCall.arguments[1]).title, /Nouveau dossier SOA/);

      sendNotification.mock.resetCalls();

      // Un compte SOA qui crée directement son propre dossier ne se
      // notifie pas lui-même (aucun appel vers NOTRE abonnement).
      await create({ firstName: "B", lastName: "C", phone: "03" }, asUser(soaUser));
      await new Promise((resolve) => setTimeout(resolve, 150));
      assert.ok(
        !sendNotification.mock.calls.some((call) => call.arguments[0].endpoint === endpoint)
      );
    } finally {
      await Member.deleteOne({ _id: presenceMember._id });
      await PushSubscription.deleteOne({ endpoint });
    }
  });

  it("notifie la CANA et le coordonnateur des bergeries à la transmission d'un dossier", async () => {
    const sendNotification = mock.method(webpush, "sendNotification", async () => {});
    const canaEndpoint = "https://push.example.invalid/newsoul-test-cana";
    const coordinateurEndpoint = "https://push.example.invalid/newsoul-test-coordinateur";

    await pushService.subscribe(canaUser._id, {
      endpoint: canaEndpoint,
      keys: { p256dh: "p256dh", auth: "auth" },
    });
    await pushService.subscribe(coordinateurUser._id, {
      endpoint: coordinateurEndpoint,
      keys: { p256dh: "p256dh", auth: "auth" },
    });

    try {
      const newSoul = await create(
        { firstName: "Jean", lastName: "Kouassi", phone: "0700000000" },
        asUser(soaUser)
      );

      await newSoulService.transmit(newSoul._id, asUser(soaUser));

      const hasBothEndpoints = () => {
        const notified = sendNotification.mock.calls.map((call) => call.arguments[0].endpoint);

        return notified.includes(canaEndpoint) && notified.includes(coordinateurEndpoint);
      };

      await waitFor(hasBothEndpoints);

      // `callCount()` exact évité pour la même raison qu'ailleurs dans
      // ce fichier (base de dev partagée entre fichiers de test
      // exécutés en parallèle) : on vérifie que NOS deux abonnements
      // ont bien reçu l'appel, pas le total.
      assert.ok(hasBothEndpoints());

      const ourCall = sendNotification.mock.calls.find(
        (call) => call.arguments[0].endpoint === canaEndpoint
      );
      assert.match(JSON.parse(ourCall.arguments[1]).title, /transmis à la CANA/);
    } finally {
      await PushSubscription.deleteMany({
        endpoint: { $in: [canaEndpoint, coordinateurEndpoint] },
      });
    }
  });

  it("sendUpcomingFollowUpReminders envoie un rappel une seule fois, seulement dans la fenêtre", async () => {
    const sendNotification = mock.method(webpush, "sendNotification", async () => {});
    const endpoint = "https://push.example.invalid/newsoul-test-reminder";

    await pushService.subscribe(canaUser._id, {
      endpoint,
      keys: { p256dh: "p256dh", auth: "auth" },
    });

    try {
      const dueTomorrow = await create(
        { firstName: "Rappel", lastName: "Demain", phone: "0744444444" },
        asUser(soaUser)
      );
      await newSoulService.transmit(dueTomorrow._id, asUser(soaUser));
      await newSoulService.acknowledge(dueTomorrow._id, asUser(canaUser));
      await newSoulService.updateCana(
        dueTomorrow._id,
        {
          monthlyFollowUps: [
            {
              period: "mois_1",
              reviewDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
            },
          ],
        },
        asUser(canaUser)
      );

      const dueInThreeWeeks = await create(
        { firstName: "Rappel", lastName: "Lointain", phone: "0755555555" },
        asUser(soaUser)
      );
      await newSoulService.transmit(dueInThreeWeeks._id, asUser(soaUser));
      await newSoulService.acknowledge(dueInThreeWeeks._id, asUser(canaUser));
      await newSoulService.updateCana(
        dueInThreeWeeks._id,
        {
          monthlyFollowUps: [
            {
              period: "mois_1",
              reviewDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
            },
          ],
        },
        asUser(canaUser)
      );

      sendNotification.mock.resetCalls();

      // `sendUpcomingFollowUpReminders` balaie TOUTE la collection,
      // sans filtre par test : sur la base de dev partagée, un autre
      // dossier proche de son échéance (créé par un test exécuté en
      // parallèle) peut faire monter `firstSweep` au-delà de 1 — d'où
      // `>= 1` et une vérification ciblée sur NOTRE abonnement plutôt
      // qu'un `callCount()` exact.
      const firstSweep = await newSoulService.sendUpcomingFollowUpReminders();
      assert.ok(firstSweep >= 1);

      const ourFirstCall = sendNotification.mock.calls.find(
        (call) => call.arguments[0].endpoint === endpoint
      );
      assert.ok(ourFirstCall, "aucun envoi vers notre abonnement de suivi");
      assert.match(JSON.parse(ourFirstCall.arguments[1]).title, /Suivi mensuel à venir/);

      // Un second balayage ne renvoie pas le même rappel à NOTRE
      // abonnement (peu importe ce qu'un autre test aurait pu, entre
      // temps, ajouter ailleurs).
      sendNotification.mock.resetCalls();
      await newSoulService.sendUpcomingFollowUpReminders();
      assert.ok(
        !sendNotification.mock.calls.some((call) => call.arguments[0].endpoint === endpoint)
      );

      const stored = await NewSoul.findById(dueTomorrow._id).lean();
      assert.ok(stored.cana.monthlyFollowUps[0].reminderSentAt);
    } finally {
      await PushSubscription.deleteOne({ endpoint });
    }
  });
});
