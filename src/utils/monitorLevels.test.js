import { readFileSync } from "node:fs";

import { describe, it, expect } from "vitest";

import { MONITOR_LEVELS, MONITOR_LEVEL_LABELS } from "./monitorLevels";

// Accord entre le miroir frontend et l'énumération du schéma.
//
// Le formulaire d'affectation proposait « Moniteur », « Assistant » et
// « Responsable de classe » — trois valeurs inventées, qu'aucun schéma
// n'accepte. L'enregistrement échouait sur « Les données envoyées sont
// invalides », un message qui ne désigne aucun champ.
//
// Le dépôt n'a pas de code partagé entre le site et l'API : ce test lit
// donc le modèle Mongoose sur le disque et compare. C'est le seul moyen
// de faire échouer la divergence au lieu de la découvrir en production.
describe("niveaux de moniteur — miroir du schéma", () => {
  it("la liste frontend est identique à celle du modèle Mongoose", () => {
    const model = readFileSync(
      "backend/src/models/MonitorAssignment.js",
      "utf8"
    );

    const match = model.match(/export const MONITOR_LEVELS = \[([^\]]+)\]/);

    expect(
      match,
      "MONITOR_LEVELS doit rester exporté par le modèle"
    ).not.toBeNull();

    const fromModel = match[1]
      .split(",")
      .map((value) => value.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);

    expect(MONITOR_LEVELS).toEqual(fromModel);
  });

  it("chaque niveau porte un libellé affichable", () => {
    for (const level of MONITOR_LEVELS) {
      expect(MONITOR_LEVEL_LABELS[level]).toBeTruthy();
    }
  });
});
