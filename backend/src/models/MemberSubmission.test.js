import { describe, it } from "node:test";
import assert from "node:assert/strict";

import MemberSubmission from "./MemberSubmission.js";

// Validation de schéma pure : pas besoin de base de données.
describe("MemberSubmission (modèle) — validation du schéma", () => {
  it("exige `type` parmi 'new' ou 'update'", () => {
    const missing = new MemberSubmission({ data: { firstName: "Jean" } });
    assert.ok(missing.validateSync().errors.type);

    const invalid = new MemberSubmission({
      type: "autre",
      data: { firstName: "Jean" },
    });
    assert.ok(invalid.validateSync().errors.type);

    const valid = new MemberSubmission({
      type: "new",
      data: { firstName: "Jean" },
    });
    assert.equal(valid.validateSync(), undefined);
  });

  it("exige `data`", () => {
    const doc = new MemberSubmission({ type: "new" });
    assert.ok(doc.validateSync().errors.data);
  });

  it("applique le statut par défaut 'pending'", () => {
    const doc = new MemberSubmission({
      type: "new",
      data: { firstName: "Jean" },
    });
    assert.equal(doc.status, "pending");
  });

  it("rejette un statut hors énumération", () => {
    const doc = new MemberSubmission({
      type: "new",
      data: { firstName: "Jean" },
      status: "en_cours",
    });
    assert.ok(doc.validateSync().errors.status);
  });
});
