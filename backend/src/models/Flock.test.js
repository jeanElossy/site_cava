import { describe, it } from "node:test";
import assert from "node:assert/strict";

import Flock from "./Flock.js";

// Test PUR : `validateSync()` n'ouvre aucune connexion — rien à
// nettoyer, aucun risque pour la base de développement partagée.

const base = (extra = {}) => ({
  code: "OL",
  name: "Bergerie des Oliviers",
  church: 1,
  ...extra,
});

const LEADER_ID = "665f1c2d4e5a6b7c8d9e0f11";

describe("Flock — désignation du responsable", () => {
  it("accepte une bergerie sans responsable", () => {
    const doc = new Flock(base());

    assert.equal(doc.validateSync(), undefined);
    assert.equal(doc.leader, undefined);
  });

  it("traduit une liste déroulante vide en absence de responsable", () => {
    // Le `<select>` de l'administration envoie une CHAÎNE VIDE quand
    // aucun membre n'est choisi. Sans le setter du modèle, Mongoose
    // échouerait sur « Cast to ObjectId failed » au moment précis où
    // l'administrateur retire un responsable.
    for (const vide of ["", null]) {
      const doc = new Flock(base({ leader: vide }));

      assert.equal(doc.validateSync(), undefined);
      assert.equal(doc.leader, undefined);
    }
  });

  it("refuse un identifiant de responsable qui n'en est pas un", () => {
    assert.ok(new Flock(base({ leader: "pas-un-id" })).validateSync()?.errors?.leader);
  });

  it("retombe sur « actif » plutôt que de laisser le statut vide", () => {
    // Point sensible : `resolveFlockAccess` exige « actif ». Un statut
    // resté vide aurait donné une bergerie au responsable désigné mais
    // au portail fermé, sans le moindre message. Poser explicitement
    // `undefined` court-circuiterait la valeur par défaut de Mongoose,
    // d'où un repli explicite dans le setter.
    for (const vide of ["", null, undefined]) {
      assert.equal(new Flock(base({ leaderStatus: vide })).leaderStatus, "actif");
    }
  });

  it("accepte la mise en retrait, refuse un statut inventé", () => {
    assert.equal(
      new Flock(base({ leaderStatus: "suspendu" })).validateSync(),
      undefined
    );

    assert.ok(
      new Flock(base({ leaderStatus: "en_conges" })).validateSync()?.errors
        ?.leaderStatus
    );
  });

  it("garde les règles existantes du code de bergerie", () => {
    // Le code fait partie du matricule des membres : l'ajout du
    // responsable ne doit rien y changer.
    assert.ok(new Flock(base({ code: "OLI" })).validateSync()?.errors?.code);
    assert.equal(new Flock(base({ code: "ol" })).code, "OL");
  });

  it("n'exige toujours qu'un code, un nom et une église", () => {
    const doc = new Flock({ leader: LEADER_ID });
    const errors = Object.keys(doc.validateSync()?.errors ?? {}).sort();

    assert.deepEqual(errors, ["church", "code", "name"]);
  });
});
