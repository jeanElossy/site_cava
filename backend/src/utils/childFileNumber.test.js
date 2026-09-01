import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  childFileNumberOf,
  formatChildFileNumber,
  isValidChildFileNumber,
  normalizeChildFileNumber,
} from "./childFileNumber.js";

describe("childFileNumber — mise en forme", () => {
  it("complète le rang sur six chiffres", () => {
    assert.equal(formatChildFileNumber(1), "CAVA-ENF-000001");
    assert.equal(formatChildFileNumber(124), "CAVA-ENF-000124");
    assert.equal(formatChildFileNumber(999999), "CAVA-ENF-999999");
  });

  it("refuse un rang absent, nul ou négatif", () => {
    assert.equal(formatChildFileNumber(0), null);
    assert.equal(formatChildFileNumber(-1), null);
    assert.equal(formatChildFileNumber(1.5), null);
    assert.equal(formatChildFileNumber(undefined), null);
  });
});

describe("childFileNumber — normalisation de ce qu'un humain recopie", () => {
  it("accepte la casse, les espaces et les tirets manquants", () => {
    assert.equal(normalizeChildFileNumber("cava-enf-000124"), "CAVA-ENF-000124");
    assert.equal(normalizeChildFileNumber("CAVAENF000124"), "CAVA-ENF-000124");
    assert.equal(normalizeChildFileNumber(" CAVA ENF 000124 "), "CAVA-ENF-000124");
  });

  it("complète un numéro saisi sans ses zéros de tête", () => {
    assert.equal(normalizeChildFileNumber("CAVA-ENF-124"), "CAVA-ENF-000124");
  });

  it("répare les confusions O/0 et I/1, déterministes sur la partie numérique", () => {
    assert.equal(normalizeChildFileNumber("CAVA-ENF-OOO124"), "CAVA-ENF-000124");
    assert.equal(normalizeChildFileNumber("CAVA-ENF-OOOI24"), "CAVA-ENF-000124");
  });

  it("refuse ce qui n'est pas un numéro de dossier", () => {
    assert.equal(normalizeChildFileNumber("1ME19016P"), null, "un matricule membre n'en est pas un");
    assert.equal(normalizeChildFileNumber("CAVA-ENF-1234567"), null, "sept chiffres");
    assert.equal(normalizeChildFileNumber("CAVA-MEM-000124"), null);
    assert.equal(normalizeChildFileNumber(""), null);
    assert.equal(normalizeChildFileNumber(null), null);
  });
});

describe("childFileNumber — extraction du rang", () => {
  it("retrouve le rang contenu dans un numéro", () => {
    assert.equal(childFileNumberOf("CAVA-ENF-000124"), 124);
    assert.equal(childFileNumberOf("cava enf 1"), 1);
  });

  it("renvoie null sur une valeur invalide", () => {
    assert.equal(childFileNumberOf("1ME19016P"), null);
  });
});

describe("childFileNumber — validation stricte", () => {
  it("n'accepte que la forme canonique", () => {
    assert.equal(isValidChildFileNumber("CAVA-ENF-000124"), true);
    assert.equal(isValidChildFileNumber("CAVA-ENF-124"), false, "forme non complétée");
    assert.equal(isValidChildFileNumber("cava-enf-000124"), false, "minuscules");
  });
});
