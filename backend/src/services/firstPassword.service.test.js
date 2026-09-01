import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import User from "../models/User.js";
import * as authService from "./auth.service.js";
import { TOKEN_SCOPE } from "../middlewares/auth.js";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

// Mot de passe temporaire et première connexion — module Enfants
// (espace moniteur), voir docs/SUIVI-MODULE-ENFANTS.md, lot 1.
//
// Église 5 (bac à sable), matricules improbables en production,
// nettoyage par identifiants exacts : cette suite ne supprime jamais
// par un critère large, un autre fichier de test pouvant utiliser la
// même église au même instant.
const TEMP_PASSWORD = "MotDePasseTemporaire123!";
const NEW_PASSWORD = "MonNouveauMotDePasse456!";

const MONITOR_MATRICULE = "5ZZ00901Z";
const CLASSIC_MATRICULE = "5ZZ00902A";

let monitor;
let classic;

const createdIds = () => [monitor?._id, classic?._id].filter(Boolean);

describe("auth.service — mot de passe temporaire (intégration MongoDB)", () => {
  before(async () => {
    await connectTestDb();

    monitor = await User.create({
      name: "Monitrice Test Suite",
      registrationNumber: MONITOR_MATRICULE,
      password: TEMP_PASSWORD,
      role: "moniteur",
      passwordChangeRequired: true,
    });

    classic = await User.create({
      name: "Agent Test Suite Sans Temporaire",
      registrationNumber: CLASSIC_MATRICULE,
      password: TEMP_PASSWORD,
      role: "social_agent",
    });
  });

  after(async () => {
    await User.deleteMany({ _id: { $in: createdIds() } });
    await disconnectTestDb();
  });

  // ---- Non-régression : le drapeau est absent partout ailleurs ----

  it("un compte SANS mot de passe temporaire reçoit un jeton de session, comme avant", async () => {
    const result = await authService.login({
      identifier: CLASSIC_MATRICULE,
      password: TEMP_PASSWORD,
    });

    assert.ok(result.token, "un jeton de session doit être délivré");
    assert.equal(result.passwordChangeRequired, undefined);

    const payload = jwt.verify(result.token, env.JWT_SECRET, {
      issuer: env.JWT_ISSUER,
    });

    assert.equal(payload.scope, TOKEN_SCOPE.SESSION);
  });

  it("le drapeau vaut false par défaut sur un compte créé sans le préciser", async () => {
    const stored = await User.findById(classic._id).lean();

    assert.equal(stored.passwordChangeRequired, false);
  });

  // ---- Le chemin du mot de passe temporaire ----

  it("un mot de passe temporaire n'ouvre AUCUNE session", async () => {
    const result = await authService.login({
      identifier: MONITOR_MATRICULE,
      password: TEMP_PASSWORD,
    });

    assert.equal(result.passwordChangeRequired, true);
    assert.equal(result.token, undefined, "aucun jeton de session ne doit être délivré");
    assert.ok(result.changeToken);

    const payload = jwt.verify(result.changeToken, env.JWT_SECRET, {
      issuer: env.JWT_ISSUER,
    });

    assert.equal(payload.scope, TOKEN_SCOPE.PASSWORD_CHANGE);
  });

  it("le jeton de changement ne peut pas se faire passer pour une session", async () => {
    const { changeToken } = await authService.login({
      identifier: MONITOR_MATRICULE,
      password: TEMP_PASSWORD,
    });

    // Symétrique du verrou 2FA : `requireAuth` refuse toute portée qui
    // n'est pas SESSION. On vérifie ici la portée elle-même, la route
    // étant couverte par le test d'intégration des routes.
    const payload = jwt.verify(changeToken, env.JWT_SECRET, {
      issuer: env.JWT_ISSUER,
    });

    assert.notEqual(payload.scope, TOKEN_SCOPE.SESSION);
  });

  it("refuse un nouveau mot de passe identique au temporaire", async () => {
    const { changeToken } = await authService.login({
      identifier: MONITOR_MATRICULE,
      password: TEMP_PASSWORD,
    });

    await assert.rejects(
      () =>
        authService.changeFirstPassword({
          changeToken,
          currentPassword: TEMP_PASSWORD,
          newPassword: TEMP_PASSWORD,
        }),
      /différent de l'ancien/
    );
  });

  it("refuse un nouveau mot de passe trop court", async () => {
    const { changeToken } = await authService.login({
      identifier: MONITOR_MATRICULE,
      password: TEMP_PASSWORD,
    });

    await assert.rejects(
      () =>
        authService.changeFirstPassword({
          changeToken,
          currentPassword: TEMP_PASSWORD,
          newPassword: "court",
        }),
      /12 caractères/
    );
  });

  it("refuse un mauvais mot de passe temporaire", async () => {
    const { changeToken } = await authService.login({
      identifier: MONITOR_MATRICULE,
      password: TEMP_PASSWORD,
    });

    await assert.rejects(
      () =>
        authService.changeFirstPassword({
          changeToken,
          currentPassword: "CeMotDePasseEstFaux999!",
          newPassword: NEW_PASSWORD,
        }),
      /temporaire est incorrect/
    );

    // Le compte reste en attente de changement : un échec ne doit pas
    // lever le drapeau.
    const stored = await User.findById(monitor._id).lean();
    assert.equal(stored.passwordChangeRequired, true);
  });

  it("refuse un jeton de changement falsifié ou expiré", async () => {
    await assert.rejects(
      () =>
        authService.changeFirstPassword({
          changeToken: "pas.un.jeton",
          currentPassword: TEMP_PASSWORD,
          newPassword: NEW_PASSWORD,
        }),
      /Délai dépassé/
    );
  });

  // ---- Le changement lui-même, et ce qu'il rend impossible ----

  it("change le mot de passe, lève le drapeau et ouvre enfin la session", async () => {
    const { changeToken } = await authService.login({
      identifier: MONITOR_MATRICULE,
      password: TEMP_PASSWORD,
    });

    const result = await authService.changeFirstPassword({
      changeToken,
      currentPassword: TEMP_PASSWORD,
      newPassword: NEW_PASSWORD,
    });

    assert.ok(result.token, "la session s'ouvre à l'issue du changement");

    const payload = jwt.verify(result.token, env.JWT_SECRET, {
      issuer: env.JWT_ISSUER,
    });

    assert.equal(payload.scope, TOKEN_SCOPE.SESSION);

    const stored = await User.findById(monitor._id).lean();

    assert.equal(stored.passwordChangeRequired, false);
    assert.ok(stored.passwordChangedAt instanceof Date);
  });

  it("le mot de passe temporaire ne fonctionne plus", async () => {
    await assert.rejects(
      () =>
        authService.login({
          identifier: MONITOR_MATRICULE,
          password: TEMP_PASSWORD,
        }),
      /Identifiants incorrects/
    );
  });

  it("le nouveau mot de passe ouvre une session normale", async () => {
    const result = await authService.login({
      identifier: MONITOR_MATRICULE,
      password: NEW_PASSWORD,
    });

    assert.ok(result.token);
    assert.equal(result.passwordChangeRequired, undefined);
    assert.equal(result.user.role, "moniteur");
  });

  it("un jeton de changement ne peut pas resservir une fois le drapeau retombé", async () => {
    // Jeton obtenu AVANT le changement, encore valide dans le temps :
    // c'est le drapeau en base, et non l'expiration, qui le neutralise.
    const stale = jwt.sign(
      { sub: String(monitor._id), scope: TOKEN_SCOPE.PASSWORD_CHANGE },
      env.JWT_SECRET,
      { expiresIn: "15m", issuer: env.JWT_ISSUER }
    );

    await assert.rejects(
      () =>
        authService.changeFirstPassword({
          changeToken: stale,
          currentPassword: NEW_PASSWORD,
          newPassword: "EncoreUnAutreMotDePasse789!",
        }),
      /déjà été modifié/
    );
  });
});
