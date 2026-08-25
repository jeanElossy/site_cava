import { describe, it, expect } from "vitest";

import {
  letterForNumber,
  normalizeRegistrationNumber,
  formatRegistrationNumber,
  hasValidShape,
  hasValidControlLetter,
  parseRegistrationNumber,
} from "./registrationNumber";

// Mêmes cas que le service backend équivalent
// (backend/src/services/registrationNumber.service.js) : les deux
// implémentations doivent rester en phase.

describe("letterForNumber", () => {
  it("associe le rang 1 à la lettre A", () => {
    expect(letterForNumber(1)).toBe("A");
  });

  it("associe le rang 26 à la lettre Z", () => {
    expect(letterForNumber(26)).toBe("Z");
  });

  it("reboucle sur A après Z (rang 27)", () => {
    expect(letterForNumber(27)).toBe("A");
  });
});

describe("normalizeRegistrationNumber", () => {
  it("met en majuscules et retire espaces et tirets", () => {
    expect(normalizeRegistrationNumber("1ol 16-005 e")).toBe("1OL16005E");
  });

  it("renvoie une chaîne vide pour une entrée vide ou absente", () => {
    expect(normalizeRegistrationNumber("")).toBe("");
    expect(normalizeRegistrationNumber(undefined)).toBe("");
    expect(normalizeRegistrationNumber(null)).toBe("");
  });
});

describe("formatRegistrationNumber", () => {
  it("insère les séparateurs de lecture", () => {
    expect(formatRegistrationNumber("1OL16005E")).toBe("1OL 16-005 E");
  });

  it("renvoie la valeur telle quelle si elle ne correspond pas au format", () => {
    expect(formatRegistrationNumber("PASDUTOUT")).toBe("PASDUTOUT");
  });

  it("renvoie une chaîne vide pour une entrée absente", () => {
    expect(formatRegistrationNumber(undefined)).toBe("");
  });
});

describe("hasValidShape", () => {
  it("accepte un matricule bien formé", () => {
    expect(hasValidShape("1OL16005E")).toBe(true);
  });

  it("rejette une chaîne qui ne respecte pas le format", () => {
    expect(hasValidShape("PASDUTOUT")).toBe(false);
  });

  it("rejette une entrée absente", () => {
    expect(hasValidShape(undefined)).toBe(false);
  });
});

describe("hasValidControlLetter", () => {
  it("valide une lettre de contrôle correcte", () => {
    expect(hasValidControlLetter("1OL16005E")).toBe(true);
  });

  it("détecte une lettre de contrôle incorrecte", () => {
    expect(hasValidControlLetter("1OL16005Z")).toBe(false);
  });

  it("rejette un format invalide", () => {
    expect(hasValidControlLetter("PASDUTOUT")).toBe(false);
  });

  // Cas issu du registre papier : le rang 44 correspond à la lettre R.
  it("valide le cas réel 1ME23044R", () => {
    expect(hasValidControlLetter("1ME23044R")).toBe(true);
  });

  // Le matricule fautif original (numéro dupliqué 043 avec la lettre
  // du rang 44) doit être détecté comme invalide.
  it("détecte le cas fautif du registre papier 1ME23043R", () => {
    expect(hasValidControlLetter("1ME23043R")).toBe(false);
  });
});

describe("parseRegistrationNumber", () => {
  it("décompose un matricule bien formé", () => {
    expect(parseRegistrationNumber("1ME23044R")).toEqual({
      church: 1,
      flockCode: "ME",
      year: 23,
      number: 44,
      letter: "R",
    });
  });

  it("renvoie null pour un format invalide", () => {
    expect(parseRegistrationNumber("PASDUTOUT")).toBeNull();
  });

  it("renvoie null pour une entrée absente", () => {
    expect(parseRegistrationNumber(undefined)).toBeNull();
    expect(parseRegistrationNumber(null)).toBeNull();
  });
});
