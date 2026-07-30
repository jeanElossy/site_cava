import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import RegistrationCounter from "../models/RegistrationCounter.js";
import {
  letterForNumber,
  normalizeRegistrationNumber,
  formatRegistrationNumber,
  parseRegistrationNumber,
  hasValidControlLetter,
  nextRegistrationNumber,
} from "./registrationNumber.service.js";

// ---- Fonctions pures (aucune base de données) ----------------------

describe("registrationNumber.service — fonctions pures", () => {
  it("letterForNumber fait correspondre le rang à une lettre, en rebouclant après Z", () => {
    assert.equal(letterForNumber(1), "A");
    assert.equal(letterForNumber(26), "Z");
    assert.equal(letterForNumber(27), "A");
  });

  it("normalizeRegistrationNumber met en majuscules et retire espaces/tirets", () => {
    assert.equal(normalizeRegistrationNumber("1ol 16-005 e"), "1OL16005E");
  });

  it("formatRegistrationNumber ajoute les séparateurs de lecture", () => {
    assert.equal(formatRegistrationNumber("1OL16005E"), "1OL 16-005 E");
  });

  it("formatRegistrationNumber renvoie l'entrée telle quelle si la forme est invalide", () => {
    assert.equal(formatRegistrationNumber("PASDUTOUT"), "PASDUTOUT");
    assert.equal(formatRegistrationNumber(""), "");
  });

  it("parseRegistrationNumber décompose un matricule canonique", () => {
    const parsed = parseRegistrationNumber("1ME23044R");

    assert.deepEqual(parsed, {
      church: 1,
      flockCode: "ME",
      year: 23,
      number: 44,
      letter: "R",
    });
  });

  it("parseRegistrationNumber renvoie null pour une forme invalide", () => {
    assert.equal(parseRegistrationNumber("PASDUTOUT"), null);
    assert.equal(parseRegistrationNumber(""), null);
  });

  it("hasValidControlLetter détecte une lettre cohérente avec le rang (registre papier, ligne 044)", () => {
    // Ligne 044 corrigée du registre papier (043 -> 044) : la lettre R
    // est correcte pour le rang 44.
    assert.equal(hasValidControlLetter("1ME23044R"), true);
  });

  it("hasValidControlLetter détecte une lettre incohérente (matricule fautif du registre, numéro 043 dupliqué)", () => {
    assert.equal(hasValidControlLetter("1ME23043R"), false);
  });

  it("hasValidControlLetter renvoie false pour une forme invalide", () => {
    assert.equal(hasValidControlLetter("PASDUTOUT"), false);
  });
});

// ---- nextRegistrationNumber (nécessite MongoDB) --------------------

describe("registrationNumber.service — nextRegistrationNumber (intégration MongoDB)", () => {
  // Église fictive, hors plage réelle (1-5), pour ne jamais interférer
  // avec un compteur de production.
  const TEST_CHURCH = 9;

  before(async () => {
    await connectTestDb();
    await RegistrationCounter.deleteOne({ church: TEST_CHURCH });
  });

  after(async () => {
    await RegistrationCounter.deleteOne({ church: TEST_CHURCH });
    await disconnectTestDb();
  });

  it("génère des matricules consécutifs pour une même église", async () => {
    const first = await nextRegistrationNumber({
      church: TEST_CHURCH,
      flockCode: "ZZ",
      year: 2026,
    });

    assert.equal(first.number, 1);
    assert.equal(first.letter, "A");
    assert.equal(first.registrationNumber, "9ZZ26001A");

    const second = await nextRegistrationNumber({
      church: TEST_CHURCH,
      flockCode: "ZZ",
      year: 2026,
    });

    assert.equal(second.number, 2);
    assert.equal(second.letter, "B");
    assert.equal(second.registrationNumber, "9ZZ26002B");
  });

  it("attribue toujours un numéro distinct même sous appels concurrents (atomicité de $inc)", async () => {
    await RegistrationCounter.deleteOne({ church: TEST_CHURCH });

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        nextRegistrationNumber({
          church: TEST_CHURCH,
          flockCode: "ZZ",
          year: 2026,
        })
      )
    );

    const numbers = results.map((result) => result.number).sort(
      (a, b) => a - b
    );

    assert.deepEqual(numbers, [1, 2, 3, 4, 5]);
  });
});
