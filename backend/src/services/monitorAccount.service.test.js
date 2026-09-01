import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";

import User from "../models/User.js";
import Member from "../models/Member.js";
import MonitorAssignment from "../models/MonitorAssignment.js";
import SundaySchoolClass from "../models/SundaySchoolClass.js";

import * as accountService from "./monitorAccount.service.js";

// Comptes de l'espace moniteur : ouverture, réinitialisation,
// désactivation, révocation.
//
// C'est le chemin par lequel passe chaque moniteur, et il n'était pas
// couvert. Le suivi le classait « partiel » — voir le lot 9.
//
// ------------------------------------------------------------------
// ÉGLISE 3, comme child.service.test.js
// ------------------------------------------------------------------
// Ce fichier crée des `Member` et des `User`, aucune ressource unique
// par église. Nettoyage par identifiants exacts.
const TEST_CHURCH = 3;
const MARKER = "TestsuiteMonitorAccount";

// Matricules de l'église 3, bergerie fictive ZY, avec la lettre de
// contrôle qui correspond au rang — le schéma refuse toute autre.
// alphabet[(rang - 1) % 26] : 801 → U, 802 → V, 803 → W.
const MAT_MONITEUR = "3ZY00801U";
const MAT_SANS_CLASSE = "3ZY00802V";
const MAT_AUTRE_COMPTE = "3ZY00803W";
const MAT_SANS_MATRICULE = null;

const userIds = [];
const memberIds = [];
const classIds = [];
const assignmentIds = [];

let classe;
let moniteur;
let sansClasse;

describe("monitorAccount.service — accès à l'espace moniteur", () => {
  before(async () => {
    await connectTestDb();

    classe = await SundaySchoolClass.create({
      name: `${MARKER} classe`,
      church: TEST_CHURCH,
      status: "published",
    });

    classIds.push(classe._id);

    moniteur = await Member.create({
      firstName: "Gisele",
      lastName: MARKER,
      church: TEST_CHURCH,
      status: "actif",
      registrationNumber: MAT_MONITEUR,
    });

    sansClasse = await Member.create({
      firstName: "Sans",
      lastName: MARKER,
      church: TEST_CHURCH,
      status: "actif",
      registrationNumber: MAT_SANS_CLASSE,
    });

    memberIds.push(moniteur._id, sansClasse._id);

    const assignment = await MonitorAssignment.create({
      member: moniteur._id,
      primaryClass: classe._id,
      church: TEST_CHURCH,
      status: "active",
    });

    assignmentIds.push(assignment._id);
  });

  after(async () => {
    await User.deleteMany({ _id: { $in: userIds } });
    await User.deleteMany({
      registrationNumber: {
        $in: [MAT_MONITEUR, MAT_SANS_CLASSE, MAT_AUTRE_COMPTE].filter(Boolean),
      },
    });
    await MonitorAssignment.deleteMany({ _id: { $in: assignmentIds } });
    await Member.deleteMany({ _id: { $in: memberIds } });
    await SundaySchoolClass.deleteMany({ _id: { $in: classIds } });

    await disconnectTestDb();
  });

  // ---- Ouverture ----

  it("ouvre un accès et rend UNE SEULE FOIS le mot de passe temporaire", async () => {
    const { account, temporaryPassword } = await accountService.openAccess(
      { memberId: String(moniteur._id) },
      null
    );

    userIds.push(account.id ?? account._id);

    assert.equal(account.role, "moniteur");
    assert.equal(account.registrationNumber, MAT_MONITEUR);

    // Il est dicté à voix haute puis tapé sur un téléphone : l'alphabet
    // exclut les caractères qui se confondent à l'oral comme à l'écrit.
    assert.ok(temporaryPassword.length >= 12);
    assert.doesNotMatch(
      temporaryPassword,
      /[O0Il1]/,
      "le mot de passe ne doit contenir ni O/0 ni I/l/1"
    );

    const stored = await User.findOne({ registrationNumber: MAT_MONITEUR })
      .select("+password passwordChangeRequired")
      .lean();

    assert.equal(stored.passwordChangeRequired, true);
    assert.notEqual(
      stored.password,
      temporaryPassword,
      "le mot de passe doit être haché en base"
    );
  });

  it("le compte se connecte par MATRICULE, jamais par e-mail", async () => {
    const stored = await User.findOne({
      registrationNumber: MAT_MONITEUR,
    }).lean();

    assert.equal(stored.email, undefined);
    assert.equal(stored.registrationNumber, MAT_MONITEUR);
  });

  it("refuse d'ouvrir un accès moniteur à un membre sans classe", async () => {
    await assert.rejects(
      () => accountService.openAccess({ memberId: String(sansClasse._id) }, null),
      (error) => {
        assert.equal(error.status, 422);

        return /classe/i.test(error.message);
      }
    );
  });

  it("refuse un membre sans matricule — le matricule EST l'identifiant", async () => {
    const anonyme = await Member.create({
      firstName: "Anonyme",
      lastName: MARKER,
      church: TEST_CHURCH,
      status: "actif",
      registrationNumber: MAT_SANS_MATRICULE,
    });

    memberIds.push(anonyme._id);

    const assignment = await MonitorAssignment.create({
      member: anonyme._id,
      primaryClass: classe._id,
      church: TEST_CHURCH,
      status: "active",
    });

    assignmentIds.push(assignment._id);

    await assert.rejects(
      () => accountService.openAccess({ memberId: String(anonyme._id) }, null),
      (error) => error.status === 422 && /matricule/i.test(error.message)
    );
  });

  it("refuse un membre introuvable", async () => {
    await assert.rejects(
      () =>
        accountService.openAccess(
          { memberId: "64b7f1e2c3d4e5f6a7b8c9d0" },
          null
        ),
      (error) => error.status === 422
    );
  });

  it("refuse un rôle étranger au module", async () => {
    await assert.rejects(
      () =>
        accountService.openAccess(
          { memberId: String(moniteur._id), role: "admin" },
          null
        ),
      (error) => error.status === 400
    );
  });

  it("refuse de doubler un compte d'un AUTRE métier", async () => {
    const agent = await Member.create({
      firstName: "Agent",
      lastName: MARKER,
      church: TEST_CHURCH,
      status: "actif",
      registrationNumber: MAT_AUTRE_COMPTE,
    });

    memberIds.push(agent._id);

    const assignment = await MonitorAssignment.create({
      member: agent._id,
      primaryClass: classe._id,
      church: TEST_CHURCH,
      status: "active",
    });

    assignmentIds.push(assignment._id);

    const compte = await User.create({
      name: `Agent ${MARKER}`,
      registrationNumber: MAT_AUTRE_COMPTE,
      role: "social_agent",
      password: "MotDePasseExistant123!",
    });

    userIds.push(compte._id);

    // Un membre n'a jamais deux identités : le service refuse plutôt
    // que d'écraser le rôle du compte existant.
    await assert.rejects(
      () => accountService.openAccess({ memberId: String(agent._id) }, null),
      (error) => error.status === 409
    );
  });

  it("refuse un mot de passe imposé trop court", async () => {
    await assert.rejects(
      () =>
        accountService.openAccess(
          { memberId: String(moniteur._id), password: "court" },
          null
        ),
      (error) => error.status === 422
    );
  });

  // ---- Réinitialisation ----

  it("réinitialise le mot de passe et remet le drapeau", async () => {
    const compte = await User.findOne({ registrationNumber: MAT_MONITEUR });

    // On simule un moniteur qui avait déjà choisi son mot de passe.
    compte.passwordChangeRequired = false;
    compte.passwordChangedAt = new Date();
    await compte.save();

    const { temporaryPassword } = await accountService.resetPassword(
      String(compte._id)
    );

    assert.ok(temporaryPassword.length >= 12);

    const apres = await User.findById(compte._id).lean();

    assert.equal(apres.passwordChangeRequired, true);
    assert.equal(
      apres.passwordChangedAt,
      undefined,
      "la date du dernier changement doit repartir à zéro"
    );
  });

  it("refuse de réinitialiser un compte qui n'est pas du module", async () => {
    const etranger = await User.create({
      name: `Etranger ${MARKER}`,
      email: `etranger.testsuite.monitoraccount@example.invalid`,
      role: "editor",
      password: "MotDePasseEtranger123!",
    });

    userIds.push(etranger._id);

    await assert.rejects(() => accountService.resetPassword(String(etranger._id)));
  });

  // ---- Activation et révocation ----

  it("désactive puis réactive un compte", async () => {
    const compte = await User.findOne({ registrationNumber: MAT_MONITEUR });

    assert.equal(
      (await accountService.setActive(String(compte._id), false)).isActive,
      false
    );
    assert.equal(
      (await accountService.setActive(String(compte._id), true)).isActive,
      true
    );
  });

  it("révoquer détache le compte de l'affectation, sans supprimer la fonction", async () => {
    const compte = await User.findOne({ registrationNumber: MAT_MONITEUR });

    await MonitorAssignment.updateOne(
      { member: moniteur._id },
      { account: compte._id }
    );

    await accountService.revokeAccess(String(compte._id));

    const assignment = await MonitorAssignment.findOne({
      member: moniteur._id,
    }).lean();

    assert.equal(assignment.account, undefined, "le lien au compte doit tomber");
    assert.equal(
      assignment.status,
      "active",
      "la FONCTION de moniteur, elle, subsiste : révoquer un accès n'est pas retirer une classe"
    );

    const apres = await User.findById(compte._id).lean();

    assert.equal(apres.isActive, false);
  });
});
