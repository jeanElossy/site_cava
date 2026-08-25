import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import User from "../models/User.js";
import * as authService from "./auth.service.js";

// Connexion par matricule (agents de terrain) en complément de la
// connexion par e-mail (admin/editor) — voir
// docs/superpowers/specs/2026-08-11-agents-matricule-login-design.md.
// Église 5 fictive, matricule improbable en production réelle,
// nettoyage par identifiant exact.
const MATRICULE = "5AA00801U";
const PASSWORD = "MotDePasseTemporaire123!";

// Compte admin JETABLE, dédié à ce test — jamais le vrai compte admin
// de production. Un test qui vérifie le chemin "mauvais mot de passe"
// a un effet de bord réel (compteur d'échecs, verrouillage
// temporaire — voir User.js#incrementLoginAttempts) : le viser contre
// le vrai compte admin l'aurait verrouillé à chaque exécution de la
// suite, incident vécu concrètement lors de cette même session
// (verrouillage temporaire du compte admin réel après plusieurs
// relances de la suite complète).
const THROWAWAY_ADMIN_EMAIL = "admin.testsuite.auth@example.invalid";

let agentUser;
let throwawayAdmin;

describe("auth.service#login (intégration MongoDB)", () => {
  before(async () => {
    await connectTestDb();

    agentUser = await User.create({
      name: "Agent Matricule Test",
      registrationNumber: MATRICULE,
      password: PASSWORD,
      role: "social_agent",
    });

    throwawayAdmin = await User.create({
      name: "Admin Test Suite Auth",
      email: THROWAWAY_ADMIN_EMAIL,
      password: PASSWORD,
      role: "admin",
    });
  });

  after(async () => {
    await User.deleteMany({ _id: { $in: [agentUser._id, throwawayAdmin._id] } });
    await disconnectTestDb();
  });

  it("connecte un agent avec son matricule", async () => {
    const result = await authService.login({
      identifier: MATRICULE,
      password: PASSWORD,
    });

    assert.ok(result.token);
    assert.equal(result.user.role, "social_agent");
    assert.equal(result.user.registrationNumber, MATRICULE);
  });

  it("le matricule est insensible à la casse et aux espaces/tirets", async () => {
    const result = await authService.login({
      // Même matricule que la fixture (5AA00801U), écrit comme un
      // humain le recopie : minuscules, espace et tiret.
      identifier: "5aa 008-01u",
      password: PASSWORD,
    });

    assert.ok(result.token);
    assert.equal(result.user.id, String(agentUser._id));
  });

  it("refuse un matricule inexistant avec le message générique", async () => {
    await assert.rejects(
      () =>
        authService.login({
          identifier: "5AA00899O",
          password: PASSWORD,
        }),
      /Identifiants incorrects/
    );
  });

  it("refuse un e-mail inexistant avec le MÊME message générique (pas d'énumération)", async () => {
    await assert.rejects(
      () =>
        authService.login({
          identifier: "personne.testsuite.auth@example.invalid",
          password: PASSWORD,
        }),
      /Identifiants incorrects/
    );
  });

  it("refuse un mauvais mot de passe sur un compte matricule, sans révéler que le compte existe", async () => {
    await assert.rejects(
      () =>
        authService.login({
          identifier: MATRICULE,
          password: "MauvaisMotDePasse000!",
        }),
      /Identifiants incorrects/
    );

    const stored = await User.findById(agentUser._id).select("+failedLoginAttempts");
    assert.ok(stored.failedLoginAttempts >= 1);
  });

  it("une chaîne qui ne ressemble ni à un matricule ni à un e-mail existant échoue proprement (pas de plantage)", async () => {
    await assert.rejects(
      () =>
        authService.login({
          identifier: "ceci n'est ni l'un ni l'autre",
          password: PASSWORD,
        }),
      /Identifiants incorrects/
    );
  });

  it("connecte un compte admin par e-mail (comportement inchangé)", async () => {
    const result = await authService.login({
      identifier: THROWAWAY_ADMIN_EMAIL,
      password: PASSWORD,
    });

    assert.ok(result.token);
    assert.equal(result.user.role, "admin");
    assert.equal(result.user.email, THROWAWAY_ADMIN_EMAIL);
  });

  it("refuse un mauvais mot de passe sur un compte admin par e-mail, avec le même message générique", async () => {
    await assert.rejects(
      () =>
        authService.login({
          identifier: THROWAWAY_ADMIN_EMAIL,
          password: "ce mot de passe est faux",
        }),
      /Identifiants incorrects/
    );
  });
});
