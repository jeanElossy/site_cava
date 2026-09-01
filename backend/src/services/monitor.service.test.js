import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import Member from "../models/Member.js";
import SundaySchoolClass from "../models/SundaySchoolClass.js";
import MonitorAssignment from "../models/MonitorAssignment.js";
import MonitorSubstitution from "../models/MonitorSubstitution.js";
import * as monitorService from "./monitor.service.js";
import * as substitutionService from "./substitution.service.js";

// LE test du module : qui a accès à quelle classe, et quand.
//
// ÉGLISE 2 — choisie délibérément. Les églises 3 et 4 sont nettoyées
// par `Member.deleteMany({ church })` dans les suites du Service
// Social : y créer des membres les ferait disparaître en pleine
// assertion (voir CLAUDE.md, « symptôme typique d'un nettoyage trop
// large »). Cette suite ne crée par ailleurs AUCUNE ressource unique
// par église, donc elle peut partager l'église 2 sans exclure personne.
//
// Nettoyage par identifiants exacts, jamais par un critère large.
const TEST_CHURCH = 2;
const MARKER = "TestsuiteMonitorAccess";

// Jours de référence, tous dans le passé ou le futur lointain pour ne
// jamais dépendre de la date d'exécution.
const DAY_SUB = new Date("2026-08-30T00:00:00.000Z");
const DAY_AFTER = new Date("2026-08-31T10:00:00.000Z");
const DAY_BEFORE = new Date("2026-08-29T10:00:00.000Z");

let sarah;
let jean;
let classeSarah;
let classeJean;
let substitution;

const createdMembers = [];
const createdClasses = [];

describe("monitor.service#resolveMonitorAccess (intégration MongoDB)", () => {
  before(async () => {
    await connectTestDb();

    sarah = await Member.create({
      firstName: "Sarah",
      lastName: MARKER,
      church: TEST_CHURCH,
      status: "actif",
    });

    jean = await Member.create({
      firstName: "Jean",
      lastName: MARKER,
      church: TEST_CHURCH,
      status: "actif",
    });

    createdMembers.push(sarah._id, jean._id);

    classeSarah = await SundaySchoolClass.create({
      name: `${MARKER} 6-8 ans`,
      church: TEST_CHURCH,
    });

    classeJean = await SundaySchoolClass.create({
      name: `${MARKER} 9-11 ans`,
      church: TEST_CHURCH,
    });

    createdClasses.push(classeSarah._id, classeJean._id);

    await MonitorAssignment.create({
      member: sarah._id,
      primaryClass: classeSarah._id,
      church: TEST_CHURCH,
      status: "active",
    });

    await MonitorAssignment.create({
      member: jean._id,
      primaryClass: classeJean._id,
      church: TEST_CHURCH,
      status: "active",
    });

    substitution = await MonitorSubstitution.create({
      monitor: sarah._id,
      replacedMonitor: jean._id,
      class: classeJean._id,
      church: TEST_CHURCH,
      mode: "session",
      sessionDates: [DAY_SUB],
      reason: "Absence du moniteur",
      status: "valide",
    });
  });

  after(async () => {
    await MonitorSubstitution.deleteMany({ monitor: { $in: createdMembers } });
    await MonitorAssignment.deleteMany({ member: { $in: createdMembers } });
    await SundaySchoolClass.deleteMany({ _id: { $in: createdClasses } });
    await Member.deleteMany({ _id: { $in: createdMembers } });
    await disconnectTestDb();
  });

  // ---- Classe principale : accès permanent ----

  it("Sarah voit sa classe principale, n'importe quel jour", async () => {
    const access = await monitorService.resolveMonitorAccess(sarah._id, {
      at: DAY_BEFORE,
    });

    assert.deepEqual(access.primaryClassIds, [String(classeSarah._id)]);
    assert.ok(access.classIds.includes(String(classeSarah._id)));
  });

  // ---- Le jour du remplacement : DEUX classes ----

  it("le jour du remplacement, Sarah voit DEUX classes", async () => {
    const access = await monitorService.resolveMonitorAccess(sarah._id, {
      at: DAY_SUB,
    });

    assert.equal(access.classIds.length, 2);
    assert.ok(access.classIds.includes(String(classeSarah._id)));
    assert.ok(access.classIds.includes(String(classeJean._id)));
  });

  it("le remplacement n'a PAS modifié sa classe principale", async () => {
    const assignment = await MonitorAssignment.findOne({ member: sarah._id }).lean();

    assert.equal(
      String(assignment.primaryClass),
      String(classeSarah._id),
      "la classe principale doit rester intacte — règle centrale du module"
    );
  });

  it("la classe remplacée est bien marquée comme telle, avec le moniteur remplacé", async () => {
    const result = await monitorService.resolveClassAccess(sarah._id, classeJean._id, {
      at: DAY_SUB,
    });

    assert.equal(result.allowed, true);
    assert.equal(result.via, "remplacement");
    assert.ok(result.substitution);
    assert.equal(
      String(result.substitution.replacedMonitor._id),
      String(jean._id),
      "l'identité du moniteur remplacé doit rester attachée — exigence d'audit"
    );
  });

  it("sa classe principale reste marquée « principale », jamais « remplacement »", async () => {
    const result = await monitorService.resolveClassAccess(sarah._id, classeSarah._id, {
      at: DAY_SUB,
    });

    assert.equal(result.via, "principale");
    assert.equal(result.substitution, null);
  });

  // ---- LE test de sécurité : l'expiration ----

  it("LE LENDEMAIN, l'accès à la seconde classe est refusé — sans qu'aucun job ne soit passé", async () => {
    const access = await monitorService.resolveMonitorAccess(sarah._id, {
      at: DAY_AFTER,
    });

    assert.equal(access.classIds.length, 1);
    assert.ok(!access.classIds.includes(String(classeJean._id)));

    const result = await monitorService.resolveClassAccess(sarah._id, classeJean._id, {
      at: DAY_AFTER,
    });

    assert.equal(result.allowed, false);
  });

  it("la veille non plus, l'accès n'est pas encore ouvert", async () => {
    const result = await monitorService.resolveClassAccess(sarah._id, classeJean._id, {
      at: DAY_BEFORE,
    });

    assert.equal(result.allowed, false);
  });

  it("le document du remplacement est resté « valide » — c'est bien le CALCUL qui ferme l'accès", async () => {
    const stored = await MonitorSubstitution.findById(substitution._id).lean();

    assert.equal(stored.status, "valide");
  });

  // ---- Annulation ----

  it("un remplacement annulé ferme l'accès immédiatement, même le bon jour", async () => {
    await substitutionService.cancel(substitution._id, { reason: "Test" });

    const result = await monitorService.resolveClassAccess(sarah._id, classeJean._id, {
      at: DAY_SUB,
    });

    assert.equal(result.allowed, false);

    // Remise en état pour les tests suivants.
    await MonitorSubstitution.updateOne(
      { _id: substitution._id },
      { status: "valide", $unset: { cancelledAt: "", cancelReason: "" } }
    );
  });

  // ---- Cloisonnement entre moniteurs ----

  it("Jean ne voit QUE sa classe — le remplacement de Sarah ne lui donne rien", async () => {
    const access = await monitorService.resolveMonitorAccess(jean._id, { at: DAY_SUB });

    assert.deepEqual(access.classIds, [String(classeJean._id)]);
  });

  it("un membre sans fonction de moniteur n'a accès à aucune classe", async () => {
    const outsider = await Member.create({
      firstName: "Etranger",
      lastName: MARKER,
      church: TEST_CHURCH,
      status: "actif",
    });

    createdMembers.push(outsider._id);

    const access = await monitorService.resolveMonitorAccess(outsider._id);

    assert.deepEqual(access.classIds, []);
    assert.equal(access.assignment, null);
  });

  it("une affectation SUSPENDUE ferme aussi la classe principale", async () => {
    await MonitorAssignment.updateOne({ member: jean._id }, { status: "suspendue" });

    const access = await monitorService.resolveMonitorAccess(jean._id, { at: DAY_SUB });

    assert.deepEqual(access.classIds, []);

    await MonitorAssignment.updateOne({ member: jean._id }, { status: "active" });
  });

  it("une classe ARCHIVÉE n'est plus accessible, même comme classe principale", async () => {
    await SundaySchoolClass.updateOne(
      { _id: classeSarah._id },
      { status: "archived" }
    );

    const access = await monitorService.resolveMonitorAccess(sarah._id, {
      at: DAY_BEFORE,
    });

    assert.deepEqual(access.primaryClassIds, []);

    await SundaySchoolClass.updateOne(
      { _id: classeSarah._id },
      { status: "published" }
    );
  });

  it("un identifiant absent ou invalide ne donne aucun accès, sans planter", async () => {
    assert.deepEqual((await monitorService.resolveMonitorAccess(null)).classIds, []);
    assert.deepEqual(
      (await monitorService.resolveMonitorAccess("pas-un-id")).classIds,
      []
    );
  });

  // ---- searchAssignableMembers ----
  //
  // La recherche de membres a nommer moniteur n'existait pas : l'ecran
  // ne savait que modifier une affectation, jamais en creer une, donc
  // la liste restait vide et la recherche ne pouvait rien trouver.

  it("ne renvoie rien sous deux caracteres — pas d'echantillon arbitraire de l'annuaire", async () => {
    assert.deepEqual(await monitorService.searchAssignableMembers({ search: "S" }), []);
    assert.deepEqual(await monitorService.searchAssignableMembers({ search: " " }), []);
    assert.deepEqual(await monitorService.searchAssignableMembers({}), []);
  });

  it("trouve un membre par son nom", async () => {
    const found = await monitorService.searchAssignableMembers({
      search: MARKER,
      church: TEST_CHURCH,
    });

    const names = found.map((item) => item.firstName);

    assert.ok(names.includes("Sarah"), "Sarah devrait etre trouvee");
    assert.ok(names.includes("Jean"), "Jean devrait etre trouve");
  });

  it("trouve un membre par son matricule SAISI DANS SA FORME AFFICHEE", async () => {
    // Le matricule est stocke sans separateur (`2ZZ00703A`) et lu
    // espace (`2ZZ 00-703 A`). Chercher la chaine telle quelle ne
    // trouverait jamais rien — c'est le piege que ce test verrouille.
    const cible = await Member.create({
      firstName: "Awa",
      lastName: MARKER,
      church: TEST_CHURCH,
      status: "actif",
      registrationNumber: "2ZZ00703A",
    });

    createdMembers.push(cible._id);

    const espace = await monitorService.searchAssignableMembers({
      search: "2ZZ 00-703 A",
      church: TEST_CHURCH,
    });

    assert.equal(espace.length, 1);
    assert.equal(String(espace[0].id), String(cible._id));

    // Et la confusion O/0 se repare par position.
    const confus = await monitorService.searchAssignableMembers({
      search: "2ZZ OO7O3A",
      church: TEST_CHURCH,
    });

    assert.equal(confus.length, 1, "la confusion O/0 doit etre reparee");
  });

  it("signale un membre deja moniteur au lieu de le masquer", async () => {
    const found = await monitorService.searchAssignableMembers({
      search: MARKER,
      church: TEST_CHURCH,
    });

    const trouvee = found.find((item) => item.firstName === "Sarah");

    // Sarah porte une affectation creee par ce fichier : elle doit
    // rester VISIBLE et marquee. La masquer ferait conclure a tort
    // qu'elle n'est pas dans l'annuaire.
    assert.ok(trouvee, "Sarah doit rester visible");
    assert.equal(trouvee.alreadyMonitor, true);
  });

  it("ignore un membre inactif", async () => {
    const inactif = await Member.create({
      firstName: "Zoe",
      lastName: MARKER,
      church: TEST_CHURCH,
      status: "inactif",
    });

    createdMembers.push(inactif._id);

    const found = await monitorService.searchAssignableMembers({
      search: MARKER,
      church: TEST_CHURCH,
    });

    assert.ok(
      !found.some((item) => item.firstName === "Zoe"),
      "un membre inactif ne peut pas recevoir une classe"
    );
  });

});
