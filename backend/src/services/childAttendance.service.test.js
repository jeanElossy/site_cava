import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";

import Child from "../models/Child.js";
import ChildAttendance from "../models/ChildAttendance.js";
import ChildSession from "../models/ChildSession.js";
import Member from "../models/Member.js";
import MonitorAssignment from "../models/MonitorAssignment.js";
import MonitorSubstitution from "../models/MonitorSubstitution.js";
import SundaySchoolClass from "../models/SundaySchoolClass.js";

import * as attendanceService from "./childAttendance.service.js";
import * as childService from "./child.service.js";

// Appel des présences : correction d'un pointage, historique, et
// surtout la présence enregistrée PENDANT UN REMPLACEMENT.
//
// Le suivi classait ce domaine « partiel » : l'appel lui-même était
// testé par les routes, mais ni la correction, ni l'historique, ni la
// double identité conservée sur une présence de remplacement.
//
// ------------------------------------------------------------------
// ÉGLISE 3, comme les deux autres fichiers du module
// ------------------------------------------------------------------
// Aucune ressource unique par église n'est créée ici. Nettoyage par
// identifiants exacts.
const TEST_CHURCH = 3;
const MARKER = "TestsuiteAttendance";

// alphabet[(rang - 1) % 26] : 811 → E, 812 → F.
const MAT_TITULAIRE = "3ZX00811E";
const MAT_REMPLACANT = "3ZX00812F";

// Jour fixe : la suite doit donner le même résultat quel que soit le
// jour où on la lance.
const JOUR = new Date("2026-08-30T00:00:00.000Z");

const childIds = [];
const classIds = [];
const memberIds = [];
const sessionIds = [];
const substitutionIds = [];
const assignmentIds = [];

let classe;
let titulaire;
let remplacant;
let enfant;
let seance;

describe("childAttendance.service — correction, historique, remplacement", () => {
  before(async () => {
    await connectTestDb();

    classe = await SundaySchoolClass.create({
      name: `${MARKER} classe`,
      church: TEST_CHURCH,
      status: "published",
    });

    classIds.push(classe._id);

    titulaire = await Member.create({
      firstName: "Titulaire",
      lastName: MARKER,
      church: TEST_CHURCH,
      status: "actif",
      registrationNumber: MAT_TITULAIRE,
    });

    remplacant = await Member.create({
      firstName: "Remplacant",
      lastName: MARKER,
      church: TEST_CHURCH,
      status: "actif",
      registrationNumber: MAT_REMPLACANT,
    });

    memberIds.push(titulaire._id, remplacant._id);

    const assignment = await MonitorAssignment.create({
      member: titulaire._id,
      primaryClass: classe._id,
      church: TEST_CHURCH,
      status: "active",
    });

    assignmentIds.push(assignment._id);

    const child = await childService.create({
      firstName: "Enfant",
      lastName: MARKER,
      dateOfBirth: "2020-03-01",
      gender: "garcon",
      church: TEST_CHURCH,
      currentClass: classe._id,
    });

    enfant = await Child.findById(child.id ?? child._id);
    childIds.push(enfant._id);

    seance = await ChildSession.create({
      class: classe._id,
      church: TEST_CHURCH,
      date: JOUR,
      type: "culte",
    });

    sessionIds.push(seance._id);
  });

  after(async () => {
    await ChildAttendance.deleteMany({ child: { $in: childIds } });
    await ChildSession.deleteMany({ _id: { $in: sessionIds } });
    await MonitorSubstitution.deleteMany({ _id: { $in: substitutionIds } });
    await MonitorAssignment.deleteMany({ _id: { $in: assignmentIds } });
    await Child.deleteMany({ _id: { $in: childIds } });
    await Member.deleteMany({ _id: { $in: memberIds } });
    await SundaySchoolClass.deleteMany({ _id: { $in: classIds } });

    await disconnectTestDb();
  });

  // ---- Correction ----

  it("corrige un pointage et retient QUI a corrigé", async () => {
    await attendanceService.recordRollCall(
      String(seance._id),
      { entries: [{ childId: String(enfant._id), status: "absent" }] },
      { actorMemberId: String(titulaire._id) }
    );

    await attendanceService.correct(
      String(seance._id),
      String(enfant._id),
      { status: "present", note: "Arrivé en retard" },
      { actorMemberId: String(titulaire._id) }
    );

    const ligne = await ChildAttendance.findOne({
      child: enfant._id,
      session: seance._id,
    }).lean();

    assert.equal(ligne.status, "present");
    assert.equal(ligne.note, "Arrivé en retard");

    // L'auteur de l'appel et l'auteur de la correction sont deux
    // informations distinctes : écraser le premier effacerait qui
    // avait fait l'appel initial.
    assert.equal(String(ligne.recordedBy), String(titulaire._id));
    assert.equal(String(ligne.lastModifiedBy), String(titulaire._id));
    assert.ok(ligne.lastModifiedAt);
  });

  it("une correction sur un enfant jamais pointé CRÉE la ligne", async () => {
    const autre = await childService.create({
      firstName: "Jamais",
      lastName: MARKER,
      dateOfBirth: "2021-01-01",
      gender: "fille",
      church: TEST_CHURCH,
      currentClass: classe._id,
    });

    childIds.push(autre.id ?? autre._id);

    await attendanceService.correct(
      String(seance._id),
      String(autre.id ?? autre._id),
      { status: "excuse" },
      { actorMemberId: String(titulaire._id) }
    );

    const ligne = await ChildAttendance.findOne({
      child: autre.id ?? autre._id,
      session: seance._id,
    }).lean();

    assert.equal(ligne.status, "excuse");
    assert.ok(ligne.recordedBy, "l'auteur doit être posé à la création");
  });

  it("refuse un statut hors de l'énumération", async () => {
    await assert.rejects(
      () =>
        attendanceService.correct(
          String(seance._id),
          String(enfant._id),
          { status: "peut-etre" },
          { actorMemberId: String(titulaire._id) }
        ),
      (error) => error.status === 422
    );
  });

  it("refuse une correction par quelqu'un qui n'encadre pas la classe", async () => {
    await assert.rejects(
      () =>
        attendanceService.correct(
          String(seance._id),
          String(enfant._id),
          { status: "present" },
          { actorMemberId: String(remplacant._id) }
        ),
      (error) => error.status === 403
    );
  });

  it("refuse une correction sur une séance introuvable", async () => {
    await assert.rejects(
      () =>
        attendanceService.correct(
          "64b7f1e2c3d4e5f6a7b8c9d0",
          String(enfant._id),
          { status: "present" },
          { actorMemberId: String(titulaire._id) }
        ),
      (error) => error.status === 404
    );
  });

  // ---- Remplacement ----

  it("une présence saisie EN REMPLACEMENT retient les deux identités", async () => {
    // L'accès se calcule pour AUJOURD'HUI, jamais pour la date de la
    // séance : c'est le principe du module — « qui encadre cette classe
    // en ce moment ». Le remplacement doit donc couvrir le jour où
    // l'appel est saisi, pas celui de la séance.
    const substitution = await MonitorSubstitution.create({
      monitor: remplacant._id,
      replacedMonitor: titulaire._id,
      class: classe._id,
      church: TEST_CHURCH,
      mode: "sessions",
      sessionDates: [new Date()],
      status: "valide",
    });

    substitutionIds.push(substitution._id);

    await attendanceService.recordRollCall(
      String(seance._id),
      { entries: [{ childId: String(enfant._id), status: "present" }] },
      { actorMemberId: String(remplacant._id) }
    );

    const ligne = await ChildAttendance.findOne({
      child: enfant._id,
      session: seance._id,
    })
      .populate("substitution")
      .lean();

    assert.equal(
      String(ligne.recordedBy),
      String(remplacant._id),
      "l'appel a bien été fait par le remplaçant"
    );

    // C'est tout l'enjeu : des mois plus tard, la fiche de l'enfant
    // doit pouvoir dire « pointé par X, en remplacement de Y ».
    assert.ok(ligne.substitution, "le remplacement doit rester attaché");
    assert.equal(
      String(ligne.substitution.replacedMonitor),
      String(titulaire._id)
    );
  });

  it("un remplacement daté d'HIER ne donne plus rien aujourd'hui", async () => {
    // On ferme d'abord celui du test précédent, sinon c'est lui qui
    // ouvrirait l'accès.
    await MonitorSubstitution.updateMany(
      { _id: { $in: substitutionIds } },
      { status: "annule" }
    );

    const hier = new Date();
    hier.setUTCDate(hier.getUTCDate() - 1);

    const perime = await MonitorSubstitution.create({
      monitor: remplacant._id,
      replacedMonitor: titulaire._id,
      class: classe._id,
      church: TEST_CHURCH,
      mode: "sessions",
      sessionDates: [hier],
      status: "valide",
    });

    substitutionIds.push(perime._id);

    // Le document reste « valide » : l'extinction est CALCULÉE, aucun
    // job n'a eu à passer. C'est la garantie centrale du module.
    await assert.rejects(
      () =>
        attendanceService.recordRollCall(
          String(seance._id),
          { entries: [{ childId: String(enfant._id), status: "absent" }] },
          { actorMemberId: String(remplacant._id) }
        ),
      (error) => error.status === 403
    );

    const toujoursValide = await MonitorSubstitution.findById(perime._id).lean();

    assert.equal(toujoursValide.status, "valide");
  });

  // ---- Historique ----

  it("l'historique porte le taux calculé sur TOUT l'historique", async () => {
    const historique = await childService.attendanceHistory(String(enfant._id));

    assert.ok(historique.items.length >= 1);
    assert.equal(
      historique.stats.total,
      historique.stats.present +
        historique.stats.absent +
        historique.stats.excuse
    );

    // Le taux se calcule sur l'ensemble, jamais sur la page affichée —
    // sinon il changerait en tournant les pages.
    assert.equal(
      historique.stats.rate,
      Math.round((historique.stats.present / historique.stats.total) * 100)
    );
  });

  it("l'historique nomme le moniteur remplacé", async () => {
    const historique = await childService.attendanceHistory(String(enfant._id));

    const avecRemplacement = historique.items.find((item) => item.substitution);

    assert.ok(avecRemplacement, "la présence de remplacement doit remonter");
    assert.equal(
      avecRemplacement.substitution.replacedMonitor.firstName,
      "Titulaire"
    );
  });

  it("un enfant sans aucun pointage a un taux NUL, pas zéro", async () => {
    const neuf = await childService.create({
      firstName: "Neuf",
      lastName: MARKER,
      dateOfBirth: "2022-02-02",
      gender: "garcon",
      church: TEST_CHURCH,
    });

    childIds.push(neuf.id ?? neuf._id);

    const historique = await childService.attendanceHistory(
      String(neuf.id ?? neuf._id)
    );

    assert.equal(historique.items.length, 0);

    // « 0 % de présence » se lirait comme « il n'est jamais venu »,
    // alors qu'il n'a simplement jamais été appelé.
    assert.equal(historique.stats.rate, null);
    assert.equal(historique.stats.total, 0);
  });

  it("l'historique se pagine", async () => {
    const historique = await childService.attendanceHistory(String(enfant._id), {
      limit: 1,
      page: 1,
    });

    assert.equal(historique.items.length, 1);
    assert.equal(historique.meta.limit, 1);
  });
});
