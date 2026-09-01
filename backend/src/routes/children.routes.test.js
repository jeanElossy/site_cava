import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import { signToken } from "../middlewares/auth.js";
import User from "../models/User.js";
import Member from "../models/Member.js";
import Child from "../models/Child.js";
import SundaySchoolClass from "../models/SundaySchoolClass.js";
import MonitorAssignment from "../models/MonitorAssignment.js";
import MonitorSubstitution from "../models/MonitorSubstitution.js";
import ChildSession from "../models/ChildSession.js";
import ChildAttendance from "../models/ChildAttendance.js";

const { createApp } = await import("../app.js");

// Sécurité des routes du module Enfants.
//
// ÉGLISE 2, comme monitor.service.test.js. Ce fichier ne crée AUCUNE
// ressource unique par église (pas de `SocialFundSettings`, pas de
// `SocialFundYear`) : il peut donc la partager sans exclure personne.
// Nettoyage par marqueur et par identifiants, jamais par église.
const TEST_CHURCH = 2;
const MARKER = "TestsuiteChildrenRoutes";
const EMAIL = (who) => `${who}.testsuite.children@example.invalid`;

// Jours de référence — jamais « aujourd'hui », pour que la suite donne
// le même résultat quel que soit le jour où on la lance.
const DAY_SUB = new Date("2026-08-30T00:00:00.000Z");
const DAY_AFTER = new Date("2026-08-31T00:00:00.000Z");

let app;

let adminToken;
let editorToken;
let socialToken;
let monitorToken;
let responsableToken;

let sarah;
let jean;
let classeSarah;
let classeJean;
let enfant;
let sessionSarah;
let sessionJean;
let sessionExpiree;

const userIds = [];
const memberIds = [];
const classIds = [];
const childIds = [];
const sessionIds = [];

const call = (method, path, { token, body } = {}) => {
  const headers = { "Content-Type": "application/json" };

  if (token) headers.Authorization = `Bearer ${token}`;

  return app.request(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
};

describe("routes Enfants — sécurité et cloisonnement", () => {
  before(async () => {
    await connectTestDb();

    const expressApp = createApp();

    // Petit adaptateur : `node:test` n'embarque pas supertest, et le
    // projet ne l'a pas en dépendance. On écoute sur un port éphémère
    // le temps de la suite — même approche que les autres tests de
    // routes du dépôt.
    const server = expressApp.listen(0);
    const { port } = server.address();

    app = {
      request: (path, options) =>
        fetch(`http://127.0.0.1:${port}${path}`, options),
      close: () => new Promise((resolve) => server.close(resolve)),
    };

    // ---- Membres ----
    sarah = await Member.create({
      firstName: "Sarah",
      lastName: MARKER,
      church: TEST_CHURCH,
      status: "actif",
      registrationNumber: "2ZZ00701Y",
    });

    jean = await Member.create({
      firstName: "Jean",
      lastName: MARKER,
      church: TEST_CHURCH,
      status: "actif",
      registrationNumber: "2ZZ00702Z",
    });

    memberIds.push(sarah._id, jean._id);

    // ---- Comptes ----
    const admin = await User.create({
      name: `Admin ${MARKER}`,
      email: EMAIL("admin"),
      password: "MotDePasseAdmin123!",
      role: "admin",
    });

    const editor = await User.create({
      name: `Editor ${MARKER}`,
      email: EMAIL("editor"),
      password: "MotDePasseEditor123!",
      role: "editor",
    });

    const social = await User.create({
      name: `Social ${MARKER}`,
      registrationNumber: "2ZZ00703A",
      password: "MotDePasseSocial123!",
      role: "social_agent",
    });

    const monitor = await User.create({
      name: `Sarah ${MARKER}`,
      registrationNumber: sarah.registrationNumber,
      password: "MotDePasseMoniteur123!",
      role: "moniteur",
    });

    const responsable = await User.create({
      name: `Responsable ${MARKER}`,
      registrationNumber: jean.registrationNumber,
      password: "MotDePasseResponsa123!",
      role: "responsable_ecole_dimanche",
    });

    userIds.push(admin._id, editor._id, social._id, monitor._id, responsable._id);

    adminToken = signToken(admin);
    editorToken = signToken(editor);
    socialToken = signToken(social);
    monitorToken = signToken(monitor);
    responsableToken = signToken(responsable);

    // ---- Classes ----
    classeSarah = await SundaySchoolClass.create({
      name: `${MARKER} 6-8`,
      church: TEST_CHURCH,
    });

    classeJean = await SundaySchoolClass.create({
      name: `${MARKER} 9-11`,
      church: TEST_CHURCH,
    });

    classIds.push(classeSarah._id, classeJean._id);

    await MonitorAssignment.create({
      member: sarah._id,
      primaryClass: classeSarah._id,
      church: TEST_CHURCH,
      status: "active",
    });

    // ---- Un enfant dans chaque classe ----
    enfant = await Child.create({
      fileNumber: "CAVA-ENF-900001",
      firstName: "Samuel",
      lastName: MARKER,
      church: TEST_CHURCH,
      currentClass: classeSarah._id,
      dateOfBirth: new Date("2018-03-12T00:00:00.000Z"),
      gender: "garcon",
    });

    const autreEnfant = await Child.create({
      fileNumber: "CAVA-ENF-900002",
      firstName: "Esther",
      lastName: MARKER,
      church: TEST_CHURCH,
      currentClass: classeJean._id,
      dateOfBirth: new Date("2015-06-01T00:00:00.000Z"),
      gender: "fille",
    });

    childIds.push(enfant._id, autreEnfant._id);

    // ---- Séances ----
    sessionSarah = await ChildSession.create({
      class: classeSarah._id,
      church: TEST_CHURCH,
      date: DAY_SUB,
      type: "ecole_du_dimanche",
    });

    sessionJean = await ChildSession.create({
      class: classeJean._id,
      church: TEST_CHURCH,
      date: DAY_SUB,
      type: "ecole_du_dimanche",
    });

    sessionExpiree = await ChildSession.create({
      class: classeJean._id,
      church: TEST_CHURCH,
      date: DAY_AFTER,
      type: "ecole_du_dimanche",
    });

    sessionIds.push(sessionSarah._id, sessionJean._id, sessionExpiree._id);

    // Sarah remplace Jean, UNIQUEMENT le 30/08.
    await MonitorSubstitution.create({
      monitor: sarah._id,
      replacedMonitor: jean._id,
      class: classeJean._id,
      church: TEST_CHURCH,
      mode: "session",
      sessions: [sessionJean._id],
      sessionDates: [DAY_SUB],
      status: "valide",
    });
  });

  after(async () => {
    await ChildAttendance.deleteMany({ session: { $in: sessionIds } });
    await ChildSession.deleteMany({ _id: { $in: sessionIds } });
    await MonitorSubstitution.deleteMany({ monitor: { $in: memberIds } });
    await MonitorAssignment.deleteMany({ member: { $in: memberIds } });
    await Child.deleteMany({ _id: { $in: childIds } });
    await SundaySchoolClass.deleteMany({ _id: { $in: classIds } });
    await Member.deleteMany({ _id: { $in: memberIds } });
    await User.deleteMany({ _id: { $in: userIds } });

    await app.close();
    await disconnectTestDb();
  });

  // ---- API sans authentification ----

  it("refuse toute requête sans jeton", async () => {
    for (const path of [
      "/api/admin/enfants",
      "/api/admin/enfants/classes",
      "/api/admin/enfants/moniteurs",
      "/api/monitorat/me",
      "/api/monitorat/classes",
    ]) {
      const response = await call("GET", path);

      assert.equal(response.status, 401, `${path} devrait exiger un jeton`);
    }
  });

  // ---- Mauvais rôle sur l'administration ----

  it("un compte editor n'accède pas à l'administration des enfants", async () => {
    const response = await call("GET", "/api/admin/enfants", { token: editorToken });

    assert.equal(response.status, 403);
  });

  it("un compte du Service Social non plus", async () => {
    const response = await call("GET", "/api/admin/enfants", { token: socialToken });

    assert.equal(response.status, 403);
  });

  it("un MONITEUR n'accède pas à l'administration des enfants", async () => {
    const response = await call("GET", "/api/admin/enfants", { token: monitorToken });

    assert.equal(response.status, 403);
  });

  it("l'administrateur et le responsable École du dimanche y accèdent", async () => {
    for (const token of [adminToken, responsableToken]) {
      const response = await call("GET", "/api/admin/enfants", { token });

      assert.equal(response.status, 200);
    }
  });

  // ---- Actions réservées à l'admin au sein du module ----

  it("le responsable École du dimanche ne peut PAS créer d'accès moniteur", async () => {
    const response = await call("POST", `/api/admin/enfants/moniteurs/${sarah._id}/acces`, {
      token: responsableToken,
      body: {},
    });

    assert.equal(response.status, 403);
  });

  // ---- Espace moniteur ----

  it("un compte editor n'entre pas dans l'espace moniteur", async () => {
    const response = await call("GET", "/api/monitorat/me", { token: editorToken });

    assert.equal(response.status, 403);
  });

  it("le moniteur voit son profil et sa classe principale", async () => {
    const response = await call("GET", "/api/monitorat/me", { token: monitorToken });

    assert.equal(response.status, 200);

    const payload = await response.json();

    assert.equal(payload.data.primaryClass.name, `${MARKER} 6-8`);
  });

  it("le moniteur voit les enfants de SA classe", async () => {
    const response = await call(
      "GET",
      `/api/monitorat/classes/${classeSarah._id}/enfants`,
      { token: monitorToken }
    );

    assert.equal(response.status, 200);

    const payload = await response.json();

    assert.equal(payload.data.length, 1);
    assert.equal(payload.data[0].firstName, "Samuel");
  });

  it("la liste d'appel ne divulgue ni documents, ni notes médicales, ni responsables", async () => {
    const response = await call(
      "GET",
      `/api/monitorat/classes/${classeSarah._id}/enfants`,
      { token: monitorToken }
    );

    const payload = await response.json();
    const child = payload.data[0];

    assert.equal(child.medicalNotes, undefined);
    assert.equal(child.notes, undefined);
    assert.equal(child.guardians, undefined);
  });

  // ---- LE test de cloisonnement ----

  it("le moniteur NE VOIT PAS les enfants d'une classe qui n'est pas la sienne", async () => {
    // Le remplacement porte sur le 30/08 : nous ne sommes pas ce
    // jour-là quand la suite tourne, donc l'accès doit être refusé.
    const response = await call(
      "GET",
      `/api/monitorat/classes/${classeJean._id}/enfants`,
      { token: monitorToken }
    );

    assert.equal(response.status, 403);
  });

  it("il ne peut pas non plus faire l'appel de cette classe", async () => {
    const response = await call(
      "POST",
      `/api/monitorat/seances/${sessionJean._id}/appel`,
      {
        token: monitorToken,
        body: { entries: [{ childId: String(childIds[1]), status: "present" }] },
      }
    );

    assert.equal(response.status, 403);
  });

  it("passer par l'identifiant d'une SÉANCE ne contourne pas le contrôle de classe", async () => {
    // La classe est lue depuis la séance, jamais depuis le client :
    // sans cela, un identifiant de séance suffirait à voir la liste
    // d'appel d'une classe interdite.
    const response = await call(
      "GET",
      `/api/monitorat/seances/${sessionJean._id}/appel`,
      { token: monitorToken }
    );

    assert.equal(response.status, 403);
  });

  it("« tous présents » est refusé sur une classe interdite", async () => {
    const response = await call(
      "POST",
      `/api/monitorat/seances/${sessionJean._id}/tous-presents`,
      { token: monitorToken }
    );

    assert.equal(response.status, 403);
  });

  // ---- L'appel sur sa propre classe fonctionne ----

  it("le moniteur fait l'appel de sa classe, et l'opération est idempotente", async () => {
    const body = {
      entries: [{ childId: String(enfant._id), status: "present" }],
    };

    const first = await call(
      "POST",
      `/api/monitorat/seances/${sessionSarah._id}/appel`,
      { token: monitorToken, body }
    );

    assert.equal(first.status, 200);

    // Rejouer exactement le même envoi ne doit pas créer de doublon —
    // c'est ce qui rend un bouton « réessayer » sans danger sur un
    // réseau instable.
    const second = await call(
      "POST",
      `/api/monitorat/seances/${sessionSarah._id}/appel`,
      { token: monitorToken, body }
    );

    assert.equal(second.status, 200);

    const count = await ChildAttendance.countDocuments({
      child: enfant._id,
      session: sessionSarah._id,
    });

    assert.equal(count, 1, "une seule ligne de présence, malgré deux envois");
  });

  it("la présence retient qui a fait l'appel", async () => {
    const attendance = await ChildAttendance.findOne({
      child: enfant._id,
      session: sessionSarah._id,
    }).lean();

    assert.equal(String(attendance.recordedBy), String(sarah._id));
    assert.equal(
      attendance.substitution,
      undefined,
      "sa classe principale : aucun remplacement ne doit être inscrit"
    );
  });

  it("un statut de présence inconnu est refusé", async () => {
    const response = await call(
      "POST",
      `/api/monitorat/seances/${sessionSarah._id}/appel`,
      {
        token: monitorToken,
        body: { entries: [{ childId: String(enfant._id), status: "peut-etre" }] },
      }
    );

    assert.equal(response.status, 422);
  });

  // ---- Documents ----

  it("un moniteur ne peut pas obtenir de signature d'envoi pour un document d'enfant", async () => {
    const response = await call("POST", "/api/admin/uploads/signature", {
      token: monitorToken,
      body: { folder: "childrenDocuments" },
    });

    assert.equal(response.status, 403);
  });

  it("un compte editor non plus", async () => {
    const response = await call("POST", "/api/admin/uploads/signature", {
      token: editorToken,
      body: { folder: "childrenDocuments" },
    });

    assert.equal(response.status, 403);
  });

  // ---- Ordre de resolution des routes ----
  //
  // REGRESSION. Express resout les routes dans leur ordre de
  // declaration, et `router.get("/:id")` etait declare AVANT les
  // montages `/classes`, `/moniteurs`, `/remplacements`,
  // `/responsables`, `/seances` et `/historique`. Chaque chemin
  // litteral partait donc en identifiant d'enfant, et
  // `Child.findById("remplacements")` levait un CastError que le
  // navigateur recevait en « Identifiant invalide. » — le module etait
  // inutilisable en production alors que toute la suite passait au vert.
  //
  // Ce test ne verifie pas le contenu des reponses : il verifie qu'un
  // sous-chemin n'est jamais confondu avec un identifiant. C'est ce qui
  // manquait.
  const LITERAL_PATHS = [
    "/api/admin/enfants/dashboard",
    "/api/admin/enfants/classes",
    "/api/admin/enfants/moniteurs",
    "/api/admin/enfants/remplacements",
    "/api/admin/enfants/responsables",
    "/api/admin/enfants/seances",
    "/api/admin/enfants/historique",
  ];

  for (const path of LITERAL_PATHS) {
    it(`${path} n'est pas confondu avec un identifiant d'enfant`, async () => {
      const response = await call("GET", path, { token: adminToken });

      // 404 reste acceptable pour un chemin sans verbe GET (`/seances`
      // n'expose qu'un POST) : ce qu'on refuse, c'est le CastError.
      assert.notEqual(response.status, 400);

      if (response.status === 400) return;

      const payload = await response.json().catch(() => ({}));

      assert.notEqual(payload.message, "Identifiant invalide.");
    });
  }

  it("les sous-ressources qui exposent une liste repondent bien 200", async () => {
    for (const path of [
      "/api/admin/enfants/classes",
      "/api/admin/enfants/moniteurs",
      "/api/admin/enfants/remplacements",
      "/api/admin/enfants/responsables",
      "/api/admin/enfants/historique",
    ]) {
      const response = await call("GET", path, { token: adminToken });

      assert.equal(response.status, 200, `${path} devrait repondre 200`);
    }
  });

});
