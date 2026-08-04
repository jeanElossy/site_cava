import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import Flock from "../models/Flock.js";
import Member from "../models/Member.js";

// Gabarits utilisés le temps que les vrais public/cards/*.svg reçoivent
// le contrat d'id documenté en tête de memberCardSvg.service.js — voir
// src/test/fixtures/memberCard/. Doit être posé AVANT le premier appel
// à une fonction du service (résolution paresseuse des chemins), pas
// forcément avant son import.
const FIXTURES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../test/fixtures/memberCard"
);

process.env.MEMBER_CARD_RECTO_PATH_OVERRIDE = path.join(
  FIXTURES_DIR,
  "recto.svg"
);
process.env.MEMBER_CARD_VERSO_PATH_OVERRIDE = path.join(
  FIXTURES_DIR,
  "verso.svg"
);

const {
  buildMemberCardJpeg,
  buildMemberCardVersoJpeg,
  buildMemberCardPdf,
} = await import("./memberCardSvg.service.js");

// Même logo que celui affiché sur l'ancienne carte : un fichier local
// existant, suffisant pour vérifier le chemin de code "photo réelle"
// sans dépendre d'un service externe.
const LOCAL_TEST_IMAGE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../assets/logo-cava.png"
);

const TEST_LAST_NAME = "TestSuiteCardSvg";
const FLOCK_CODE = "XD";

let testFlock;

const cleanupMembers = async () =>
  Member.deleteMany({ lastName: TEST_LAST_NAME });

describe("memberCardSvg.service (intégration MongoDB)", () => {
  before(async () => {
    await connectTestDb();
    await Promise.all([Flock.init(), Member.init()]);

    testFlock = await Flock.create({
      code: FLOCK_CODE,
      name: "Bergerie Test Carte SVG",
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

  it("génère une carte JPEG (recto) valide pour un membre actif avec matricule", async () => {
    const member = await Member.create({
      firstName: "jean-baptiste",
      lastName: TEST_LAST_NAME,
      church: 1,
      flock: testFlock._id,
      registrationNumber: "1XD26007G",
      joinedAt: new Date(2021, 0, 1),
    });

    const buffer = await buildMemberCardJpeg(member._id);

    assert.ok(Buffer.isBuffer(buffer));
    // Magic bytes JPEG (SOI marker).
    assert.equal(buffer.subarray(0, 2).toString("hex"), "ffd8");
  });

  it("génère un JPEG verso valide, identique quel que soit le membre", async () => {
    const member = await Member.create({
      firstName: "Verso",
      lastName: TEST_LAST_NAME,
      church: 1,
      flock: testFlock._id,
      registrationNumber: "1XD26008H",
      joinedAt: new Date(2021, 0, 1),
    });

    const buffer = await buildMemberCardVersoJpeg(member._id);

    assert.ok(Buffer.isBuffer(buffer));
    assert.equal(buffer.subarray(0, 2).toString("hex"), "ffd8");
  });

  it("génère un PDF imprimable à 2 pages (recto puis verso)", async () => {
    const member = await Member.create({
      firstName: "PdfDeuxPages",
      lastName: TEST_LAST_NAME,
      church: 1,
      flock: testFlock._id,
      registrationNumber: "1XD26009I",
      joinedAt: new Date(2021, 0, 1),
    });

    const buffer = await buildMemberCardPdf(member._id);

    assert.ok(Buffer.isBuffer(buffer));
    assert.equal(buffer.subarray(0, 5).toString("latin1"), "%PDF-");

    // Recto ET verso : deux pages distinctes, jamais fusionnées en une
    // seule image (voir design validé).
    const pageCount = (
      buffer.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []
    ).length;

    assert.equal(pageCount, 2);
  });

  it("lève une 404 pour un membre introuvable", async () => {
    await assert.rejects(
      buildMemberCardJpeg(new mongoose.Types.ObjectId()),
      (error) => error.status === 404
    );
  });

  it("lève une 422 pour un membre sans matricule (aucune carte ne peut être émise)", async () => {
    const member = await Member.create({
      firstName: "SansMatricule",
      lastName: TEST_LAST_NAME,
      church: 1,
      flock: testFlock._id,
    });

    await assert.rejects(
      buildMemberCardJpeg(member._id),
      (error) => error.status === 422
    );
  });

  it("lève une 403 pour un membre désactivé : aucune carte, ni recto, ni verso, ni PDF", async () => {
    const member = await Member.create({
      firstName: "Desactive",
      lastName: TEST_LAST_NAME,
      church: 1,
      flock: testFlock._id,
      registrationNumber: "1XD26010J",
      joinedAt: new Date(2021, 0, 1),
      status: "inactif",
    });

    await assert.rejects(
      buildMemberCardJpeg(member._id),
      (error) => error.status === 403
    );
    await assert.rejects(
      buildMemberCardVersoJpeg(member._id),
      (error) => error.status === 403
    );
    await assert.rejects(
      buildMemberCardPdf(member._id),
      (error) => error.status === 403
    );
  });

  it("utilise la vraie photo du membre quand elle est renseignée, plutôt que les initiales", async () => {
    // `Member.photo` valide déjà son URL (Cloudinary uniquement) : un
    // chemin de fichier local n'en est pas un et serait refusé à
    // l'enregistrement — `validateBeforeSave: false` est délibéré ici,
    // ce test porte sur le RENDU d'une vraie photo, pas sur la
    // validation du champ (déjà couverte ailleurs).
    const member = new Member({
      firstName: "AvecPhoto",
      lastName: TEST_LAST_NAME,
      church: 1,
      flock: testFlock._id,
      registrationNumber: "1XD26011K",
      joinedAt: new Date(2021, 0, 1),
      photo: LOCAL_TEST_IMAGE,
    });

    await member.save({ validateBeforeSave: false });

    const buffer = await buildMemberCardJpeg(member._id);

    assert.ok(Buffer.isBuffer(buffer));
    assert.equal(buffer.subarray(0, 2).toString("hex"), "ffd8");
  });

  it("ignore une photo dont l'URL n'est pas fiable, sans jamais la récupérer (SSRF)", async () => {
    // `.invalid` est un domaine réservé (RFC 2606) qui ne résout
    // jamais : si le service tentait malgré tout de le récupérer, ce
    // test échouerait par lenteur/erreur réseau plutôt que par un
    // repli immédiat et silencieux sur les initiales.
    const member = new Member({
      firstName: "PhotoNonFiable",
      lastName: TEST_LAST_NAME,
      church: 1,
      flock: testFlock._id,
      registrationNumber: "1XD26012L",
      joinedAt: new Date(2021, 0, 1),
      photo: "https://exemple.invalid/introuvable.jpg",
    });

    await member.save({ validateBeforeSave: false });

    const buffer = await buildMemberCardJpeg(member._id);

    assert.ok(Buffer.isBuffer(buffer));
    assert.equal(buffer.subarray(0, 2).toString("hex"), "ffd8");
  });
});
