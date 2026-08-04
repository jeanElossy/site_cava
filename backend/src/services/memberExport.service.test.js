import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import Flock from "../models/Flock.js";
import Member from "../models/Member.js";
import { buildMembersXlsx, buildMembersPdf } from "./memberExport.service.js";

// Isolation : nom de famille improbable en production, et code de
// bergerie distinct de ceux déjà utilisés par les autres suites de
// tests ("ZZ"/"YY" dans submission.service.test.js) pour éviter toute
// collision si les fichiers de test s'exécutent en parallèle.
const TEST_LAST_NAME = "TestSuiteExport";
const FLOCK_CODE = "XM";

let testFlock;

const cleanupMembers = async () =>
  Member.deleteMany({ lastName: TEST_LAST_NAME });

describe("memberExport.service (intégration MongoDB)", () => {
  before(async () => {
    await connectTestDb();
    await Promise.all([Flock.init(), Member.init()]);

    testFlock = await Flock.create({
      code: FLOCK_CODE,
      name: "Bergerie Test Export",
      church: 1,
    });
  });

  beforeEach(cleanupMembers);
  afterEach(cleanupMembers);

  after(async () => {
    await cleanupMembers();
    await Flock.deleteOne({ code: FLOCK_CODE, church: 1 });
    await disconnectTestDb();
  });

  it("buildMembersXlsx trie par ordre de séquence du matricule, pas par ordre alphabétique", async () => {
    // Numéros de séquence volontairement en désordre alphabétique par
    // prénom (Z a le plus petit numéro) : un tri par chaîne ou par nom
    // donnerait un ordre différent de celui attendu (5, 50, 99).
    await Member.create([
      {
        firstName: "NumeroZ",
        lastName: TEST_LAST_NAME,
        church: 1,
        flock: testFlock._id,
        registrationNumber: "1XM26099Z",
      },
      {
        firstName: "NumeroA",
        lastName: TEST_LAST_NAME,
        church: 1,
        flock: testFlock._id,
        registrationNumber: "1XM26005E",
      },
      {
        firstName: "NumeroM",
        lastName: TEST_LAST_NAME,
        church: 1,
        flock: testFlock._id,
        registrationNumber: "1XM26050X",
      },
      {
        // Sans matricule : doit se retrouver après tous les membres
        // matriculés, quel que soit son prénom.
        firstName: "AAAA_SansMatricule",
        lastName: TEST_LAST_NAME,
        church: 1,
        flock: testFlock._id,
      },
    ]);

    const buffer = await buildMembersXlsx({ church: 1, flock: testFlock.id });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheet = workbook.getWorksheet("Membres");
    const firstNames = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // en-tête

      if (row.getCell(2).value === TEST_LAST_NAME.toUpperCase()) {
        firstNames.push(row.getCell(3).value); // colonne "Prénom"
      }
    });

    // Casse normalisée à l'affichage (voir le test dédié plus bas) :
    // seul l'ORDRE relatif est vérifié ici.
    assert.deepEqual(firstNames, [
      "Numeroa",
      "Numerom",
      "Numeroz",
      "Aaaa_sansmatricule",
    ]);
  });

  it("buildMembersXlsx normalise la casse des noms comme la table Membres (prénom en casse de titre, NOM en majuscules)", async () => {
    await Member.create({
      firstName: "jean-baptiste",
      lastName: TEST_LAST_NAME,
      church: 1,
      flock: testFlock._id,
      registrationNumber: "1XM26007G",
    });

    const buffer = await buildMembersXlsx({ church: 1, flock: testFlock.id });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheet = workbook.getWorksheet("Membres");
    let firstName;
    let lastName;

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      if (row.getCell(2).value === TEST_LAST_NAME.toUpperCase()) {
        lastName = row.getCell(2).value;
        firstName = row.getCell(3).value;
      }
    });

    assert.equal(firstName, "Jean-Baptiste");
    assert.equal(lastName, TEST_LAST_NAME.toUpperCase());
  });

  it("exclut toujours les membres désactivés, même sans filtre de statut explicite", async () => {
    await Member.create([
      {
        firstName: "Actif",
        lastName: TEST_LAST_NAME,
        church: 1,
        flock: testFlock._id,
        registrationNumber: "1XM26010J",
        status: "actif",
      },
      {
        firstName: "Inactif",
        lastName: TEST_LAST_NAME,
        church: 1,
        flock: testFlock._id,
        registrationNumber: "1XM26011K",
        status: "inactif",
      },
    ]);

    // Un `status` fourni par l'appelant ne doit rien changer : le
    // registre exporté exclut systématiquement les membres désactivés.
    const buffer = await buildMembersXlsx({
      church: 1,
      flock: testFlock.id,
      status: "inactif",
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheet = workbook.getWorksheet("Membres");
    const firstNames = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      if (row.getCell(2).value === TEST_LAST_NAME.toUpperCase()) {
        firstNames.push(row.getCell(3).value);
      }
    });

    assert.deepEqual(firstNames, ["Actif"]);
  });

  it("buildMembersPdf renvoie un PDF valide avec le logo intégré, sans erreur", async () => {
    await Member.create({
      firstName: "Pdf",
      lastName: TEST_LAST_NAME,
      church: 1,
      flock: testFlock._id,
      registrationNumber: "1XM26001A",
    });

    const buffer = await buildMembersPdf({ church: 1, flock: testFlock.id });

    assert.ok(Buffer.isBuffer(buffer));
    assert.equal(buffer.subarray(0, 5).toString("latin1"), "%PDF-");
  });
});
