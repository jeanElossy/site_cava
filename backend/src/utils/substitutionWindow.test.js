import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  dayKey,
  isSubstitutionActiveAt,
  substitutionBounds,
  substitutionsOverlap,
} from "./substitutionWindow.js";

// Fonctions PURES : aucune base de données.
//
// C'est ici que se joue la règle de sécurité centrale du module —
// « après expiration, l'accès à la deuxième classe est automatiquement
// supprimé ». Le contrôle d'accès d'un moniteur s'y résume : si cette
// fonction dit « oui » un jour de trop, l'accès reste ouvert un jour de
// trop.
const d = (iso) => new Date(`${iso}T10:00:00.000Z`);

describe("substitutionWindow — dayKey", () => {
  it("réduit un instant à son jour civil", () => {
    assert.equal(dayKey(new Date("2026-08-30T23:59:59.000Z")), "2026-08-30");
    assert.equal(dayKey(new Date("2026-08-30T00:00:00.000Z")), "2026-08-30");
  });

  it("renvoie null sur une valeur qui n'est pas une date", () => {
    assert.equal(dayKey("pas une date"), null);
    assert.equal(dayKey(undefined), null);
  });
});

describe("substitutionWindow — remplacement sur UNE séance", () => {
  const substitution = {
    status: "valide",
    mode: "session",
    sessionDates: [new Date("2026-08-30T00:00:00.000Z")],
  };

  it("couvre le jour de la séance, quelle que soit l'heure", () => {
    assert.equal(isSubstitutionActiveAt(substitution, d("2026-08-30")), true);
    assert.equal(
      isSubstitutionActiveAt(substitution, new Date("2026-08-30T23:59:00.000Z")),
      true
    );
  });

  it("NE COUVRE PAS le lendemain — l'accès s'éteint sans qu'aucun job ne soit passé", () => {
    assert.equal(isSubstitutionActiveAt(substitution, d("2026-08-31")), false);
  });

  it("ne couvre pas la veille", () => {
    assert.equal(isSubstitutionActiveAt(substitution, d("2026-08-29")), false);
  });
});

describe("substitutionWindow — remplacement sur une PÉRIODE", () => {
  const substitution = {
    status: "valide",
    mode: "period",
    startDate: new Date("2026-08-30T00:00:00.000Z"),
    endDate: new Date("2026-09-13T00:00:00.000Z"),
  };

  it("couvre les bornes elles-mêmes", () => {
    assert.equal(isSubstitutionActiveAt(substitution, d("2026-08-30")), true);
    assert.equal(isSubstitutionActiveAt(substitution, d("2026-09-13")), true);
  });

  it("couvre un jour au milieu", () => {
    assert.equal(isSubstitutionActiveAt(substitution, d("2026-09-06")), true);
  });

  it("ne couvre ni avant ni après", () => {
    assert.equal(isSubstitutionActiveAt(substitution, d("2026-08-29")), false);
    assert.equal(isSubstitutionActiveAt(substitution, d("2026-09-14")), false);
  });
});

describe("substitutionWindow — remplacement sur PLUSIEURS séances", () => {
  const substitution = {
    status: "valide",
    mode: "sessions",
    sessionDates: [
      new Date("2026-08-30T00:00:00.000Z"),
      new Date("2026-09-06T00:00:00.000Z"),
      new Date("2026-09-13T00:00:00.000Z"),
    ],
  };

  it("couvre chacune des séances cochées", () => {
    assert.equal(isSubstitutionActiveAt(substitution, d("2026-08-30")), true);
    assert.equal(isSubstitutionActiveAt(substitution, d("2026-09-06")), true);
    assert.equal(isSubstitutionActiveAt(substitution, d("2026-09-13")), true);
  });

  it("ne couvre PAS les dimanches intercalaires non cochés", () => {
    // Le 2026-09-02 tombe entre deux séances retenues : un calcul par
    // intervalle l'aurait couvert à tort.
    assert.equal(isSubstitutionActiveAt(substitution, d("2026-09-02")), false);
  });
});

describe("substitutionWindow — ce qui ferme l'accès quoi qu'il arrive", () => {
  it("un remplacement ANNULÉ ne couvre plus rien, même en pleine période", () => {
    const substitution = {
      status: "annule",
      mode: "period",
      startDate: new Date("2026-08-01T00:00:00.000Z"),
      endDate: new Date("2026-12-31T00:00:00.000Z"),
    };

    assert.equal(isSubstitutionActiveAt(substitution, d("2026-09-01")), false);
  });

  it("un remplacement sans aucun jour ne couvre rien (et ne couvre pas TOUT par défaut)", () => {
    const substitution = { status: "valide", mode: "sessions", sessionDates: [] };

    assert.equal(isSubstitutionActiveAt(substitution, d("2026-09-01")), false);
  });

  it("une période sans dates ne couvre rien", () => {
    const substitution = { status: "valide", mode: "period" };

    assert.equal(isSubstitutionActiveAt(substitution, d("2026-09-01")), false);
  });

  it("un document absent ne couvre rien", () => {
    assert.equal(isSubstitutionActiveAt(null, d("2026-09-01")), false);
    assert.equal(isSubstitutionActiveAt(undefined, d("2026-09-01")), false);
  });
});

describe("substitutionWindow — bornes affichables", () => {
  it("rend les bornes d'une période", () => {
    const bounds = substitutionBounds({
      mode: "period",
      startDate: new Date("2026-08-30T00:00:00.000Z"),
      endDate: new Date("2026-09-13T00:00:00.000Z"),
    });

    assert.equal(dayKey(bounds.from), "2026-08-30");
    assert.equal(dayKey(bounds.to), "2026-09-13");
  });

  it("rend la première et la dernière séance, même saisies dans le désordre", () => {
    const bounds = substitutionBounds({
      mode: "sessions",
      sessionDates: [
        new Date("2026-09-13T00:00:00.000Z"),
        new Date("2026-08-30T00:00:00.000Z"),
        new Date("2026-09-06T00:00:00.000Z"),
      ],
    });

    assert.equal(dayKey(bounds.from), "2026-08-30");
    assert.equal(dayKey(bounds.to), "2026-09-13");
  });
});

describe("substitutionWindow — détection des conflits", () => {
  const period = {
    mode: "period",
    startDate: new Date("2026-08-30T00:00:00.000Z"),
    endDate: new Date("2026-09-13T00:00:00.000Z"),
  };

  it("détecte une séance isolée tombant DANS une période", () => {
    const single = {
      mode: "session",
      sessionDates: [new Date("2026-09-06T00:00:00.000Z")],
    };

    assert.equal(substitutionsOverlap(period, single), true);
    assert.equal(substitutionsOverlap(single, period), true);
  });

  it("ne signale rien pour une séance hors période", () => {
    const single = {
      mode: "session",
      sessionDates: [new Date("2026-09-20T00:00:00.000Z")],
    };

    assert.equal(substitutionsOverlap(period, single), false);
  });

  it("détecte deux périodes qui se recouvrent partiellement", () => {
    const other = {
      mode: "period",
      startDate: new Date("2026-09-10T00:00:00.000Z"),
      endDate: new Date("2026-09-20T00:00:00.000Z"),
    };

    assert.equal(substitutionsOverlap(period, other), true);
  });

  it("ne signale rien pour deux périodes qui se suivent sans se toucher", () => {
    const other = {
      mode: "period",
      startDate: new Date("2026-09-14T00:00:00.000Z"),
      endDate: new Date("2026-09-20T00:00:00.000Z"),
    };

    assert.equal(substitutionsOverlap(period, other), false);
  });
});
