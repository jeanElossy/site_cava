import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";

import Child from "../models/Child.js";
import ChildGuardian from "../models/ChildGuardian.js";
import SundaySchoolClass from "../models/SundaySchoolClass.js";

import * as childService from "./child.service.js";

// Cycle de vie d'un enfant.
//
// ------------------------------------------------------------------
// POURQUOI CE FICHIER EXISTE
// ------------------------------------------------------------------
// Le module Enfants a été livré en production sans un seul test sur
// son objet central : création, modification, changement de classe,
// désactivation, rattachement d'un responsable. C'était la seule ligne
// rouge du tableau de couverture du suivi.
//
// ------------------------------------------------------------------
// ÉGLISE 3
// ------------------------------------------------------------------
// Aucun autre fichier n'y crée de `Child` (children.routes et
// monitor.service travaillent sur l'église 2). `socialFundYear` y pose
// un `SocialFundSettings`, mais ce fichier n'en crée aucun : les deux
// ne se croisent pas.
//
// Nettoyage par identifiants exacts, jamais par église — un
// `deleteMany({ church })` emporterait les fixtures d'un fichier voisin
// en pleine assertion (voir CLAUDE.md).
const TEST_CHURCH = 3;
const MARKER = "TestsuiteChildService";

const childIds = [];
const classIds = [];
const guardianIds = [];

let classe;
let classeArchivee;

const makeChild = async (overrides = {}) => {
  const child = await childService.create({
    firstName: "Awa",
    lastName: MARKER,
    dateOfBirth: "2020-05-10",
    gender: "fille",
    church: TEST_CHURCH,
    ...overrides,
  });

  childIds.push(child.id ?? child._id);

  return child;
};

describe("child.service — cycle de vie d'un enfant (intégration MongoDB)", () => {
  before(async () => {
    await connectTestDb();

    classe = await SundaySchoolClass.create({
      name: `${MARKER} 03 à 05`,
      church: TEST_CHURCH,
      ageMin: 3,
      ageMax: 5,
      status: "published",
    });

    classeArchivee = await SundaySchoolClass.create({
      name: `${MARKER} archivée`,
      church: TEST_CHURCH,
      status: "archived",
    });

    classIds.push(classe._id, classeArchivee._id);
  });

  after(async () => {
    await Child.deleteMany({ _id: { $in: childIds } });
    await ChildGuardian.deleteMany({ _id: { $in: guardianIds } });
    await SundaySchoolClass.deleteMany({ _id: { $in: classIds } });

    await disconnectTestDb();
  });

  // ---- Création ----

  it("refuse une création sans les informations obligatoires", async () => {
    await assert.rejects(
      () => childService.create({ firstName: "Sans", lastName: "Reste" }),
      (error) => {
        assert.equal(error.status, 422);

        // Le message doit désigner CHAQUE champ manquant : un « données
        // invalides » global oblige à relire tout le formulaire.
        assert.ok(error.details.dateOfBirth);
        assert.ok(error.details.gender);

        return true;
      }
    );
  });

  it("attribue un numéro de dossier au format canonique", async () => {
    const child = await makeChild();

    assert.match(child.fileNumber, /^CAVA-ENF-\d{6}$/);
  });

  it("ne réutilise jamais un numéro de dossier", async () => {
    const [a, b] = [await makeChild(), await makeChild()];

    assert.notEqual(a.fileNumber, b.fileNumber);
  });

  it("les numéros restent uniques et croissants, même après un échec", async () => {
    const avant = await makeChild();

    await assert.rejects(() => childService.create({ firstName: "Raté" }));

    const apres = await makeChild();

    const numero = (child) => Number(child.fileNumber.slice(-6));

    assert.ok(
      numero(apres) > numero(avant),
      "le compteur ne doit jamais reculer"
    );

    // NOTE : on n'assertit PAS que la séquence est continue (`+1`).
    // Le compteur `ChildCounter` est global, et `node --test` exécute
    // les fichiers en parallèle : un autre fichier consomme des numéros
    // entre ces deux créations. La première version de ce test
    // l'exigeait et tombait dès la suite complète (60 !== 59), alors
    // qu'elle passait seule — un test qui n'échoue que dans un contexte
    // ment sur ce qu'il vérifie.
    //
    // Le fait que la validation ne consomme pas de numéro reste vrai
    // (voir `child.service.js#create`, qui appelle `assertCreatable`
    // AVANT `nextChildFileNumber`) ; il n'est simplement pas
    // observable de façon fiable sur une base partagée.
  });

  it("calcule l'âge sans le stocker", async () => {
    const child = await makeChild({ dateOfBirth: "2020-01-01" });

    assert.equal(typeof child.age, "number");

    const brut = await Child.collection.findOne({
      _id: (await Child.findById(child.id).lean())._id,
    });

    assert.equal(brut.age, undefined, "l'âge ne doit jamais être en base");
  });

  it("refuse une date de naissance dans le futur", async () => {
    const demain = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    await assert.rejects(() => makeChild({ dateOfBirth: demain }));
  });

  it("refuse une date qui correspondrait à un adulte", async () => {
    await assert.rejects(() => makeChild({ dateOfBirth: "1980-01-01" }));
  });

  // ---- Lecture ----

  it("getById signale un enfant introuvable plutôt que de renvoyer null", async () => {
    await assert.rejects(
      () => childService.getById("64b7f1e2c3d4e5f6a7b8c9d0"),
      (error) => error.status === 404
    );
  });

  // ---- Modification ----

  it("modifie une fiche", async () => {
    const child = await makeChild({ birthPlace: "" });

    const modifie = await childService.update(child.id, {
      birthPlace: "Abidjan",
      nationality: "Ivoirienne",
    });

    assert.equal(modifie.birthPlace, "Abidjan");
    assert.equal(modifie.nationality, "Ivoirienne");
  });

  it("refuse de modifier un enfant qui n'existe pas", async () => {
    await assert.rejects(
      () => childService.update("64b7f1e2c3d4e5f6a7b8c9d0", { birthPlace: "X" }),
      (error) => error.status === 404
    );
  });

  // ---- Classe ----

  it("affecte une classe et retient la date d'affectation", async () => {
    const child = await makeChild();

    const { child: affecte } = await childService.assignClass(
      child.id,
      String(classe._id)
    );

    assert.equal(String(affecte.currentClass), String(classe._id));
    assert.ok(affecte.classAssignedAt, "la date d'affectation doit être posée");
  });

  it("prévient quand l'âge sort de la tranche, sans bloquer", async () => {
    // 12 ans dans une classe 3–5 ans : le cas se produit réellement
    // (fratrie gardée ensemble), l'interdire serait un contresens.
    const annee = new Date().getUTCFullYear() - 12;

    const child = await makeChild({ dateOfBirth: `${annee}-01-01` });

    const { child: affecte, warning } = await childService.assignClass(
      child.id,
      String(classe._id)
    );

    assert.ok(warning, "un avertissement est attendu");
    assert.match(warning, /hors de la tranche/);
    assert.equal(
      String(affecte.currentClass),
      String(classe._id),
      "l'affectation doit tout de même avoir lieu"
    );
  });

  it("ne prévient pas quand l'âge est dans la tranche", async () => {
    const annee = new Date().getUTCFullYear() - 4;

    const child = await makeChild({ dateOfBirth: `${annee}-01-01` });

    const { warning } = await childService.assignClass(
      child.id,
      String(classe._id)
    );

    assert.equal(warning, null);
  });

  it("refuse une classe archivée", async () => {
    const child = await makeChild();

    await assert.rejects(
      () => childService.assignClass(child.id, String(classeArchivee._id)),
      (error) => error.status === 422
    );
  });

  it("retire la classe quand on n'en passe aucune", async () => {
    const child = await makeChild();

    await childService.assignClass(child.id, String(classe._id));

    const retire = await childService.assignClass(child.id, null);

    assert.equal(retire.currentClass, undefined);
    assert.equal(retire.classAssignedAt, undefined);
  });

  // ---- Statut ----

  it("désactive puis réactive un enfant", async () => {
    const child = await makeChild();

    assert.equal((await childService.setStatus(child.id, "inactif")).status, "inactif");
    assert.equal((await childService.setStatus(child.id, "actif")).status, "actif");
  });

  it("refuse un statut hors de l'énumération", async () => {
    const child = await makeChild();

    await assert.rejects(
      () => childService.setStatus(child.id, "supprime"),
      (error) => error.status === 400
    );
  });

  // ---- Responsables ----

  it("rattache un responsable, une seule fois", async () => {
    const guardian = await ChildGuardian.create({
      firstName: "Adjoua",
      lastName: MARKER,
      phone: "0700000001",
      church: TEST_CHURCH,
    });

    guardianIds.push(guardian._id);

    const child = await makeChild();

    const lie = await childService.attachGuardian(child.id, {
      guardianId: String(guardian._id),
      relation: "mere",
      isLegalGuardian: true,
    });

    assert.equal(lie.guardians.length, 1);
    assert.equal(lie.guardians[0].relation, "mere");
    assert.equal(lie.guardians[0].isLegalGuardian, true);

    // Responsabilité légale et autorisation de récupérer sont deux
    // choses distinctes : la seconde vaut `true` par défaut.
    assert.equal(lie.guardians[0].canPickUp, true);

    await assert.rejects(
      () =>
        childService.attachGuardian(child.id, {
          guardianId: String(guardian._id),
          relation: "mere",
        }),
      (error) => error.status === 409
    );
  });

  it("refuse de rattacher un responsable qui n'existe pas", async () => {
    const child = await makeChild();

    await assert.rejects(
      () =>
        childService.attachGuardian(child.id, {
          guardianId: "64b7f1e2c3d4e5f6a7b8c9d0",
          relation: "pere",
        }),
      (error) => error.status === 404
    );
  });

  it("détache un responsable", async () => {
    const guardian = await ChildGuardian.create({
      firstName: "Kouadio",
      lastName: MARKER,
      phone: "0700000002",
      church: TEST_CHURCH,
    });

    guardianIds.push(guardian._id);

    const child = await makeChild();

    await childService.attachGuardian(child.id, {
      guardianId: String(guardian._id),
      relation: "pere",
    });

    const detache = await childService.detachGuardian(
      child.id,
      String(guardian._id)
    );

    assert.equal(detache.guardians.length, 0);
  });

  // ---- Recherche ----

  it("retrouve un enfant par son nom", async () => {
    const child = await makeChild({ firstName: "Zoubeida" });

    const { items } = await childService.list({
      church: TEST_CHURCH,
      search: "Zoubeid",
    });

    assert.ok(items.some((item) => String(item._id) === String(child.id)));
  });

  it("retrouve un enfant par son numéro de dossier MAL RECOPIÉ", async () => {
    const child = await makeChild();

    // « cava enf 42 » plutôt que « CAVA-ENF-000042 » : c'est ce qu'on
    // tape en lisant une liste papier.
    const numero = child.fileNumber.replace("CAVA-ENF-", "cava enf ");

    const { items } = await childService.list({ search: numero });

    assert.equal(items.length, 1);
    assert.equal(String(items[0]._id), String(child.id));
  });

  it("filtre par classe", async () => {
    const child = await makeChild();

    await childService.assignClass(child.id, String(classe._id));

    const { items } = await childService.list({
      classId: String(classe._id),
    });

    assert.ok(items.every((item) => String(item.currentClass?._id) === String(classe._id)));
    assert.ok(items.some((item) => String(item._id) === String(child.id)));
  });

  it("filtre les dossiers incomplets", async () => {
    // Un enfant repris du registre papier : ni classe, ni responsable.
    const incomplet = await Child.create({
      fileNumber: "CAVA-ENF-999901",
      firstName: "Incomplet",
      lastName: MARKER,
      church: TEST_CHURCH,
      source: "registre",
    });

    childIds.push(incomplet._id);

    const complet = await makeChild();
    await childService.assignClass(complet.id, String(classe._id));

    const { items } = await childService.list({
      church: TEST_CHURCH,
      incompleteOnly: true,
    });

    const ids = items.map((item) => String(item._id));

    assert.ok(ids.includes(String(incomplet._id)));
    assert.ok(
      !ids.includes(String(complet.id)),
      "un dossier complet ne doit pas remonter dans ce filtre"
    );
  });

  it("combine recherche et filtre d'incomplétude sans s'annuler", async () => {
    // Les deux passent par `$or` : les empiler naïvement ferait
    // remonter tous les dossiers incomplets, nom cherché ou non.
    const cible = await Child.create({
      fileNumber: "CAVA-ENF-999902",
      firstName: "Chercheable",
      lastName: MARKER,
      church: TEST_CHURCH,
    });

    const autre = await Child.create({
      fileNumber: "CAVA-ENF-999903",
      firstName: "Introuvable",
      lastName: MARKER,
      church: TEST_CHURCH,
    });

    childIds.push(cible._id, autre._id);

    const { items } = await childService.list({
      church: TEST_CHURCH,
      search: "Chercheable",
      incompleteOnly: true,
    });

    const ids = items.map((item) => String(item._id));

    assert.ok(ids.includes(String(cible._id)));
    assert.ok(
      !ids.includes(String(autre._id)),
      "la recherche doit RESTREINDRE le filtre d'incomplétude, pas s'y ajouter"
    );
  });

  it("pagine sans perdre le total", async () => {
    const { items, meta } = await childService.list({
      church: TEST_CHURCH,
      limit: 2,
      page: 1,
    });

    assert.ok(items.length <= 2);
    assert.ok(meta.total >= items.length);
    assert.equal(meta.page, 1);
    assert.equal(meta.limit, 2);
  });
});
