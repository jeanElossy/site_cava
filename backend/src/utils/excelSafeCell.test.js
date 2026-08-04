import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { excelSafeCell } from "./excelSafeCell.js";

describe("excelSafeCell — neutralise l'injection de formule Excel/CSV", () => {
  it("préfixe d'une apostrophe une valeur commençant par =, +, -, @, tabulation ou retour chariot", () => {
    assert.equal(excelSafeCell("=cmd|'/c calc'!A1"), "'=cmd|'/c calc'!A1");
    assert.equal(excelSafeCell("+1234"), "'+1234");
    assert.equal(excelSafeCell("-1234"), "'-1234");
    assert.equal(excelSafeCell("@SUM(A1)"), "'@SUM(A1)");
    assert.equal(excelSafeCell("\tvaleur"), "'\tvaleur");
    assert.equal(excelSafeCell("\rvaleur"), "'\rvaleur");
  });

  it("laisse un texte normal inchangé", () => {
    assert.equal(excelSafeCell("KOUASSI"), "KOUASSI");
    assert.equal(excelSafeCell("0700000000"), "0700000000");
    assert.equal(excelSafeCell("—"), "—");
  });

  it("laisse passer null/undefined tels quels (délégué au champ appelant)", () => {
    assert.equal(excelSafeCell(null), null);
    assert.equal(excelSafeCell(undefined), undefined);
  });

  it("convertit un nombre en chaîne inoffensive", () => {
    assert.equal(excelSafeCell(45), "45");
  });
});
