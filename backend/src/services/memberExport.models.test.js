import { describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import "./memberExport.service.js";

// Test PUR : il n'ouvre aucune connexion, il vérifie seulement ce que
// l'import du module a enregistré auprès de Mongoose.
//
// Raison d'être : `fetchMembers` fait `populate("flock")`, et Mongoose
// exige que le modèle cible soit enregistré AVANT la requête. Tant que
// ces exports n'étaient appelés que par l'API, le modèle arrivait par
// ricochet — app.js monte toutes les routes, donc importe tous les
// modèles — et l'oubli restait invisible. Le premier script à appeler
// le service seul a échoué en production sur
// « MissingSchemaError: Schema hasn't been registered for model "Flock" ».
//
// Une suite d'intégration n'aurait rien vu : elle importe elle aussi
// Flock pour créer ses fixtures.
describe("memberExport.service — modèles requis par populate()", () => {
  it("enregistre Flock à l'import, sans dépendre de l'appelant", () => {
    assert.ok(
      Object.keys(mongoose.models).includes("Flock"),
      "Le modèle Flock doit être enregistré par l'import du service : " +
        "sinon tout appelant qui n'importe pas Flock lui-même (script, " +
        "tâche planifiée) échoue au populate."
    );
  });
});
