import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import Flock from "../models/Flock.js";
import Member from "../models/Member.js";
import MemberSubmission from "../models/MemberSubmission.js";
import RegistrationCounter from "../models/RegistrationCounter.js";
import * as submissionService from "./submission.service.js";

// Isolation :
//
// - Member/MemberSubmission : un nom de famille improbable en
//   production ("TestSuiteSubmission"), jamais une purge large.
// - Flock : des codes improbables ("ZZ", "YY"), sur des ÉGLISES
//   FICTIVES (2 et 3) — jamais utilisées en production aujourd'hui
//   (seule l'église 1 existe réellement, voir CLAUDE.md). Le champ
//   `church` de Flock et de Member est contraint à 1-5 par le schéma,
//   donc 2/3 restent des valeurs valides sans jamais toucher à des
//   données réelles.
// - RegistrationCounter : PAR CONSÉQUENT jamais le compteur réel de
//   l'église 1 — seulement ceux, fictifs, des églises 2 et 3, purgés
//   sans condition en fin de suite. Ancienne version de ce fichier :
//   les tests d'approbation touchaient le compteur RÉEL de l'église 1,
//   avec une logique de sauvegarde/restauration de sa valeur avant/
//   après coup. Fragile en pratique — un lancement concurrent de la
//   suite (ex. cette suite lancée deux fois à la fois, ou en parallèle
//   d'un script manuel) pouvait interrompre cette restauration et
//   laisser le compteur réel dans un état incohérent avec les
//   matricules réellement attribués. C'est très exactement ce qui
//   s'est produit une fois en production. Utiliser des églises
//   fictives élimine complètement cette classe de bug : plus aucune
//   opération de test ne touche quoi que ce soit de réel, donc plus
//   besoin de sauvegarder/restaurer un état "avant test".
const TEST_LAST_NAME = "TestSuiteSubmission";
const FLOCK_CODE = "ZZ";
const OTHER_FLOCK_CODE = "YY";
const TEST_CHURCH = 2;
const OTHER_TEST_CHURCH = 3;

let testFlockChurch1;
let testFlockChurch2;

const cleanupPeople = async () => {
  await Member.deleteMany({ lastName: TEST_LAST_NAME });
  await MemberSubmission.deleteMany({ "data.lastName": TEST_LAST_NAME });
};

describe("submission.service (intégration MongoDB)", () => {
  before(async () => {
    await connectTestDb();
    await Promise.all([
      Flock.init(),
      Member.init(),
      MemberSubmission.init(),
      RegistrationCounter.init(),
    ]);

    testFlockChurch1 = await Flock.create({
      code: FLOCK_CODE,
      name: "Bergerie Test Suite",
      church: TEST_CHURCH,
    });

    testFlockChurch2 = await Flock.create({
      code: OTHER_FLOCK_CODE,
      name: "Bergerie Test Suite (autre église)",
      church: OTHER_TEST_CHURCH,
    });
  });

  beforeEach(cleanupPeople);
  afterEach(cleanupPeople);

  after(async () => {
    await cleanupPeople();
    await Flock.deleteMany({ code: { $in: [FLOCK_CODE, OTHER_FLOCK_CODE] } });

    // Églises fictives, jamais réelles : purge sans condition, aucune
    // valeur "d'avant le test" à préserver.
    await RegistrationCounter.deleteMany({
      church: { $in: [TEST_CHURCH, OTHER_TEST_CHURCH] },
    });

    await disconnectTestDb();
  });

  // ---- submit() -----------------------------------------------------

  it("submit() rejette un type invalide", async () => {
    await assert.rejects(
      submissionService.submit({
        type: "autre",
        data: { firstName: "Jean", lastName: TEST_LAST_NAME },
      }),
      (error) => error.status === 400
    );
  });

  it("submit() exige prénom et nom", async () => {
    await assert.rejects(
      submissionService.submit({
        type: "new",
        data: { firstName: "", lastName: "" },
      }),
      (error) => error.status === 400
    );
  });

  it("submit() de type 'update' exige un matricule", async () => {
    await assert.rejects(
      submissionService.submit({
        type: "update",
        registrationNumber: "",
        data: { firstName: "Jean", lastName: TEST_LAST_NAME },
      }),
      (error) => error.status === 400
    );
  });

  it("submit() filtre les champs non autorisés (ex. `status`) et crée une soumission en attente", async () => {
    const result = await submissionService.submit({
      type: "new",
      data: {
        firstName: "Jean",
        lastName: TEST_LAST_NAME,
        church: TEST_CHURCH,
        flock: String(testFlockChurch1._id),
        phone: "0700000000",
        status: "admin", // doit être filtré
      },
    });

    assert.deepEqual(result, { received: true });

    const stored = await MemberSubmission.findOne({
      "data.lastName": TEST_LAST_NAME,
    }).lean();

    assert.equal(stored.status, "pending");
    assert.equal(stored.type, "new");
    assert.equal(stored.data.status, undefined);
    assert.equal(stored.data.phone, "0700000000");
  });

  it("submit() écarte une photo dont l'URL ne provient pas de notre Cloudinary (SSRF), sans rejeter le reste de la demande", async () => {
    const result = await submissionService.submit({
      type: "new",
      data: {
        firstName: "Jean",
        lastName: TEST_LAST_NAME,
        church: TEST_CHURCH,
        flock: String(testFlockChurch1._id),
        phone: "0700000000",
        photo: "http://169.254.169.254/latest/meta-data/",
      },
    });

    assert.deepEqual(result, { received: true });

    const stored = await MemberSubmission.findOne({
      "data.lastName": TEST_LAST_NAME,
    }).lean();

    assert.equal(
      stored.data.photo,
      undefined,
      "une URL non fiable ne doit jamais atteindre la soumission stockée"
    );
    assert.equal(
      stored.data.phone,
      "0700000000",
      "le reste de la demande doit rester intact"
    );
  });

  it("submit() de type 'update' résout `existingMember` quand le matricule correspond à un membre informatisé", async () => {
    const existingMember = await Member.create({
      firstName: "Existant",
      lastName: TEST_LAST_NAME,
      registrationNumber: "2ZZ99001A",
      church: TEST_CHURCH,
      flock: testFlockChurch1._id,
    });

    await submissionService.submit({
      type: "update",
      registrationNumber: "2zz99-001 a",
      data: { firstName: "Existant", lastName: TEST_LAST_NAME, phone: "0711111111" },
    });

    const stored = await MemberSubmission.findOne({
      "data.lastName": TEST_LAST_NAME,
    }).lean();

    assert.equal(String(stored.existingMember), String(existingMember._id));
    assert.equal(stored.submittedRegistrationNumber, "2ZZ99001A");
  });

  it("submit() de type 'update' ne résout PAS `existingMember` pour un membre désactivé — son matricule ne doit plus fonctionner nulle part sur le site", async () => {
    const inactiveMember = await Member.create({
      firstName: "Desactive",
      lastName: TEST_LAST_NAME,
      registrationNumber: "2ZZ99008H",
      church: TEST_CHURCH,
      flock: testFlockChurch1._id,
      status: "inactif",
    });

    await submissionService.submit({
      type: "update",
      registrationNumber: inactiveMember.registrationNumber,
      data: { firstName: "Desactive", lastName: TEST_LAST_NAME },
    });

    const stored = await MemberSubmission.findOne({
      submittedRegistrationNumber: inactiveMember.registrationNumber,
    }).lean();

    assert.equal(stored.existingMember, undefined);
  });

  // ---- lookup() -------------------------------------------------------
  //
  // Comportement le plus sensible à une régression silencieuse : une
  // réponse qui se mettrait à distinguer "matricule inconnu" de "nom
  // erroné", ou qui recommencerait à renvoyer `emergencyContact`, ne
  // casserait aucun autre test — d'où une couverture dédiée.

  it("lookup() renvoie les données quand le matricule et le nom correspondent, accents et casse ignorés", async () => {
    // Nom volontairement DIFFÉRENT de TEST_LAST_NAME (qui ne porte pas
    // d'accent) pour tester réellement l'insensibilité aux accents —
    // donc nettoyage explicite, hors de cleanupPeople().
    const accented = await Member.create({
      firstName: "Édouard",
      lastName: "Gnézélé",
      registrationNumber: "2ZZ99003C",
      church: TEST_CHURCH,
      flock: testFlockChurch1._id,
      phone: "0700000000",
      emergencyContact: { name: "Un Proche", phone: "0788888888" },
    });

    try {
      const result = await submissionService.lookup({
        registrationNumber: "2zz 99-003 c",
        lastName: "gnezele",
      });

      assert.equal(result.data.firstName, "Édouard");
      assert.equal(result.data.phone, "0700000000");
    } finally {
      await Member.deleteOne({ _id: accented._id });
    }
  });

  it("lookup() ne renvoie jamais le contact d'urgence (donnée d'un tiers non consentant)", async () => {
    await Member.create({
      firstName: "Édouard",
      lastName: TEST_LAST_NAME,
      registrationNumber: "2ZZ99004D",
      church: TEST_CHURCH,
      flock: testFlockChurch1._id,
      emergencyContact: { name: "Un Proche", phone: "0788888888" },
    });

    const result = await submissionService.lookup({
      registrationNumber: "2ZZ99004D",
      lastName: TEST_LAST_NAME,
    });

    assert.equal(result.data.emergencyContact, undefined);
  });

  it("lookup() ne renvoie rien si le nom ne correspond pas", async () => {
    await Member.create({
      firstName: "Jean",
      lastName: TEST_LAST_NAME,
      registrationNumber: "2ZZ99005E",
      church: TEST_CHURCH,
      flock: testFlockChurch1._id,
    });

    const result = await submissionService.lookup({
      registrationNumber: "2ZZ99005E",
      lastName: "Nom Incorrect",
    });

    assert.equal(result.data, null);
  });

  it("lookup() ne renvoie rien pour un matricule inexistant", async () => {
    const result = await submissionService.lookup({
      registrationNumber: "2ZZ99998Y",
      lastName: TEST_LAST_NAME,
    });

    assert.equal(result.data, null);
  });

  it("lookup() ne renvoie rien pour un membre désactivé, même avec le bon matricule et le bon nom — son matricule ne doit plus fonctionner nulle part sur le site", async () => {
    const inactiveMember = await Member.create({
      firstName: "Desactive",
      lastName: TEST_LAST_NAME,
      registrationNumber: "2ZZ99009I",
      church: TEST_CHURCH,
      flock: testFlockChurch1._id,
      status: "inactif",
    });

    const result = await submissionService.lookup({
      registrationNumber: inactiveMember.registrationNumber,
      lastName: TEST_LAST_NAME,
    });

    assert.equal(result.data, null);
  });

  it("lookup() verrouille un matricule après 5 échecs de nom, même avec le bon nom ensuite, sans affecter un autre matricule", async () => {
    const locked = await Member.create({
      firstName: "Jean",
      lastName: TEST_LAST_NAME,
      registrationNumber: "2ZZ99006F",
      church: TEST_CHURCH,
      flock: testFlockChurch1._id,
    });

    const other = await Member.create({
      firstName: "Paul",
      lastName: TEST_LAST_NAME,
      registrationNumber: "2ZZ99007G",
      church: TEST_CHURCH,
      flock: testFlockChurch1._id,
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      await submissionService.lookup({
        registrationNumber: locked.registrationNumber,
        lastName: "Nom Incorrect",
      });
    }

    const stillLocked = await submissionService.lookup({
      registrationNumber: locked.registrationNumber,
      lastName: TEST_LAST_NAME,
    });

    assert.equal(
      stillLocked.data,
      null,
      "le matricule verrouillé doit rester bloqué même avec le bon nom"
    );

    const unaffected = await submissionService.lookup({
      registrationNumber: other.registrationNumber,
      lastName: TEST_LAST_NAME,
    });

    assert.equal(
      unaffected.data.firstName,
      "Paul",
      "un autre matricule ne doit pas être affecté par le verrou"
    );
  });

  // ---- listPending() / getById() ------------------------------------

  it("listPending() renvoie les soumissions en attente avec la métadonnée de pagination", async () => {
    await submissionService.submit({
      type: "new",
      data: { firstName: "Jean", lastName: TEST_LAST_NAME },
    });

    const { items, meta } = await submissionService.listPending({
      page: 1,
      limit: 10,
    });

    const found = items.find((item) => item.data.lastName === TEST_LAST_NAME);

    assert.ok(found, "la soumission créée doit apparaître dans la liste");
    assert.equal(found.status, "pending");
    assert.ok(meta.total >= 1);
  });

  it("getById() renvoie la soumission et `currentMember: null` en l'absence de membre existant", async () => {
    await submissionService.submit({
      type: "new",
      data: { firstName: "Jean", lastName: TEST_LAST_NAME },
    });

    const created = await MemberSubmission.findOne({
      "data.lastName": TEST_LAST_NAME,
    }).lean();

    const { submission, currentMember } = await submissionService.getById(
      created._id
    );

    assert.equal(String(submission._id), String(created._id));
    assert.equal(currentMember, null);
  });

  it("getById() lève une 404 pour une soumission introuvable", async () => {
    await assert.rejects(
      submissionService.getById(new mongoose.Types.ObjectId()),
      (error) => error.status === 404
    );
  });

  // ---- approve() ------------------------------------------------------

  it("approve() crée un nouveau membre avec un matricule généré et marque la soumission comme approuvée", async () => {
    await submissionService.submit({
      type: "new",
      data: {
        firstName: "Nouveau",
        lastName: TEST_LAST_NAME,
        church: TEST_CHURCH,
        flock: String(testFlockChurch1._id),
        phone: "0700000002",
      },
    });

    const pending = await MemberSubmission.findOne({
      "data.lastName": TEST_LAST_NAME,
    }).lean();

    const { member, submission } = await submissionService.approve(
      pending._id,
      { user: { id: new mongoose.Types.ObjectId() } }
    );

    assert.match(member.registrationNumber, /^2ZZ\d{2}\d{3}[A-Z]$/);
    assert.equal(submission.status, "approved");
    assert.ok(submission.processedAt);
  });

  it("un membre créé via une nouvelle inscription en ligne peut ensuite être retrouvé et mis à jour par son matricule (pas seulement les membres importés du registre papier)", async () => {
    // Étape 1 : inscription en ligne d'un tout nouveau membre.
    await submissionService.submit({
      type: "new",
      data: {
        firstName: "Fraichement",
        lastName: TEST_LAST_NAME,
        church: TEST_CHURCH,
        flock: String(testFlockChurch1._id),
        phone: "0700000099",
      },
    });

    const pendingNew = await MemberSubmission.findOne({
      "data.lastName": TEST_LAST_NAME,
      type: "new",
    }).lean();

    const { member: createdMember } = await submissionService.approve(
      pendingNew._id,
      { user: { id: new mongoose.Types.ObjectId() } }
    );

    // Étape 2 : il revient plus tard avec ce matricule tout juste
    // attribué pour compléter sa fiche — le "j'ai déjà un matricule"
    // du formulaire public doit fonctionner pour lui comme pour un
    // membre historique digitalisé depuis le registre papier.
    const found = await submissionService.lookup({
      registrationNumber: createdMember.registrationNumber,
      lastName: TEST_LAST_NAME,
    });

    assert.equal(found.data.firstName, "Fraichement");

    await submissionService.submit({
      type: "update",
      registrationNumber: createdMember.registrationNumber,
      data: {
        firstName: "Fraichement",
        lastName: TEST_LAST_NAME,
        // Le formulaire public redemande toujours église et bergerie,
        // même en mise à jour (l'étape Identité n'est pas conditionnée
        // au type de soumission) : `approve()` les exige quel que soit
        // le parcours.
        church: TEST_CHURCH,
        flock: String(testFlockChurch1._id),
        phone: "0711111199",
      },
    });

    const pendingUpdate = await MemberSubmission.findOne({
      "data.lastName": TEST_LAST_NAME,
      type: "update",
    }).lean();

    assert.equal(
      String(pendingUpdate.existingMember),
      String(createdMember._id ?? createdMember.id),
      "la mise à jour doit se rattacher au membre fraîchement créé, pas en créer un nouveau"
    );

    const { member: updatedMember } = await submissionService.approve(
      pendingUpdate._id,
      { user: { id: new mongoose.Types.ObjectId() } }
    );

    assert.equal(updatedMember.phone, "0711111199");
    assert.equal(
      updatedMember.registrationNumber,
      createdMember.registrationNumber,
      "le matricule ne doit pas changer lors d'une mise à jour"
    );

    const countAfter = await Member.countDocuments({
      lastName: TEST_LAST_NAME,
    });
    assert.equal(countAfter, 1, "toujours un seul membre, pas de doublon créé");
  });

  it("approve() refuse une nouvelle inscription si un membre du même nom existe déjà dans la même église (accents et casse ignorés)", async () => {
    await Member.create({
      firstName: "Doublon",
      lastName: TEST_LAST_NAME,
      church: TEST_CHURCH,
      flock: testFlockChurch1._id,
    });

    await submissionService.submit({
      type: "new",
      data: {
        // Casse et accent différents de la fiche existante : la
        // comparaison doit malgré tout les traiter comme identiques.
        firstName: "dôublon",
        lastName: TEST_LAST_NAME,
        church: TEST_CHURCH,
        flock: String(testFlockChurch1._id),
      },
    });

    const pending = await MemberSubmission.findOne({
      "data.firstName": "dôublon",
    }).lean();

    const counterBefore = await RegistrationCounter.findOne({
      church: TEST_CHURCH,
    }).lean();

    await assert.rejects(
      submissionService.approve(pending._id, {
        user: { id: new mongoose.Types.ObjectId() },
      }),
      (error) => error.status === 409
    );

    const counterAfter = await RegistrationCounter.findOne({
      church: TEST_CHURCH,
    }).lean();

    assert.equal(
      counterAfter?.lastNumber,
      counterBefore?.lastNumber,
      "un refus ne doit pas consommer de matricule"
    );

    const stillPending = await MemberSubmission.findById(pending._id).lean();
    assert.equal(
      stillPending.status,
      "pending",
      "la soumission refusée reste en attente, pas marquée traitée"
    );

    const membersCount = await Member.countDocuments({
      lastName: TEST_LAST_NAME,
    });
    assert.equal(
      membersCount,
      1,
      "aucun second membre ne doit avoir été créé"
    );
  });

  it("approve() autorise le même nom dans une église différente", async () => {
    await Member.create({
      firstName: "MemeNom",
      lastName: TEST_LAST_NAME,
      church: TEST_CHURCH,
      flock: testFlockChurch1._id,
    });

    await submissionService.submit({
      type: "new",
      data: {
        firstName: "MemeNom",
        lastName: TEST_LAST_NAME,
        church: OTHER_TEST_CHURCH,
        flock: String(testFlockChurch2._id),
      },
    });

    const pending = await MemberSubmission.findOne({
      "data.church": OTHER_TEST_CHURCH,
      "data.lastName": TEST_LAST_NAME,
    }).lean();

    const { member } = await submissionService.approve(pending._id, {
      user: { id: new mongoose.Types.ObjectId() },
    });

    assert.equal(member.church, OTHER_TEST_CHURCH);
  });

  it("approve() dérive `joinedAt` de `arrivalYear` plutôt que d'utiliser la date du jour, et conserve `area`", async () => {
    await submissionService.submit({
      type: "new",
      data: {
        firstName: "AnneeArrivee",
        lastName: TEST_LAST_NAME,
        church: TEST_CHURCH,
        flock: String(testFlockChurch1._id),
        area: "Angré 7e tranche",
        arrivalYear: 2021,
      },
    });

    const pending = await MemberSubmission.findOne({
      "data.lastName": TEST_LAST_NAME,
    }).lean();

    const { member } = await submissionService.approve(pending._id, {
      user: { id: new mongoose.Types.ObjectId() },
    });

    assert.equal(member.area, "Angré 7e tranche");
    assert.equal(
      new Date(member.joinedAt).getFullYear(),
      2021,
      "joinedAt doit refléter l'année saisie par le membre, pas la date du jour"
    );
    assert.match(
      member.registrationNumber,
      /^2ZZ21\d{3}[A-Z]$/,
      "le millésime du matricule doit lui aussi refléter `arrivalYear`, pas l'année du jour"
    );
  });

  it("approve() se rabat sur la date du jour quand `arrivalYear` n'est pas fourni", async () => {
    const before = new Date();

    await submissionService.submit({
      type: "new",
      data: {
        firstName: "SansAnnee",
        lastName: TEST_LAST_NAME,
        church: TEST_CHURCH,
        flock: String(testFlockChurch1._id),
      },
    });

    const pending = await MemberSubmission.findOne({
      "data.lastName": TEST_LAST_NAME,
    }).lean();

    const { member } = await submissionService.approve(pending._id, {
      user: { id: new mongoose.Types.ObjectId() },
    });

    assert.ok(new Date(member.joinedAt) >= before);
  });

  it("approve() met à jour un membre existant plutôt que d'en créer un nouveau (parcours 'update')", async () => {
    const existingMember = await Member.create({
      firstName: "Existant",
      lastName: TEST_LAST_NAME,
      registrationNumber: "2ZZ99002B",
      church: TEST_CHURCH,
      flock: testFlockChurch1._id,
      phone: "0700000000",
    });

    await submissionService.submit({
      type: "update",
      registrationNumber: "2ZZ99002B",
      data: { firstName: "Existant", lastName: TEST_LAST_NAME, phone: "0722222222" },
    });

    const pending = await MemberSubmission.findOne({
      "data.lastName": TEST_LAST_NAME,
    }).lean();

    const { member } = await submissionService.approve(pending._id, {
      overrides: { church: TEST_CHURCH, flock: String(testFlockChurch1._id) },
      user: { id: new mongoose.Types.ObjectId() },
    });

    assert.equal(String(member._id), String(existingMember._id));
    assert.equal(member.phone, "0722222222");
    // Le matricule d'origine n'est jamais réattribué lors d'une mise à
    // jour.
    assert.equal(member.registrationNumber, "2ZZ99002B");

    const countAfter = await Member.countDocuments({
      lastName: TEST_LAST_NAME,
    });
    assert.equal(countAfter, 1, "aucun second membre ne doit être créé");
  });

  it("approve() lève une 422 si l'église ou la bergerie sont absentes", async () => {
    await submissionService.submit({
      type: "new",
      data: { firstName: "Incomplet", lastName: TEST_LAST_NAME },
    });

    const pending = await MemberSubmission.findOne({
      "data.lastName": TEST_LAST_NAME,
    }).lean();

    await assert.rejects(
      submissionService.approve(pending._id, {
        user: { id: new mongoose.Types.ObjectId() },
      }),
      (error) => error.status === 422
    );
  });

  it("approve() lève une 400 si la bergerie n'appartient pas à l'église indiquée", async () => {
    await submissionService.submit({
      type: "new",
      data: {
        firstName: "Incoherent",
        lastName: TEST_LAST_NAME,
        church: TEST_CHURCH,
        // Bergerie de l'autre église fictive, pour une soumission
        // déclarée sur TEST_CHURCH.
        flock: String(testFlockChurch2._id),
      },
    });

    const pending = await MemberSubmission.findOne({
      "data.lastName": TEST_LAST_NAME,
    }).lean();

    await assert.rejects(
      submissionService.approve(pending._id, {
        user: { id: new mongoose.Types.ObjectId() },
      }),
      (error) => error.status === 400
    );
  });

  it("approve() lève une 409 sur une soumission déjà traitée", async () => {
    await submissionService.submit({
      type: "new",
      data: {
        firstName: "DejaTraite",
        lastName: TEST_LAST_NAME,
        church: TEST_CHURCH,
        flock: String(testFlockChurch1._id),
      },
    });

    const pending = await MemberSubmission.findOne({
      "data.lastName": TEST_LAST_NAME,
    }).lean();

    await submissionService.approve(pending._id, {
      user: { id: new mongoose.Types.ObjectId() },
    });

    await assert.rejects(
      submissionService.approve(pending._id, {
        user: { id: new mongoose.Types.ObjectId() },
      }),
      (error) => error.status === 409
    );
  });

  it("approve() lève une 404 pour une soumission introuvable", async () => {
    await assert.rejects(
      submissionService.approve(new mongoose.Types.ObjectId(), {
        user: { id: new mongoose.Types.ObjectId() },
      }),
      (error) => error.status === 404
    );
  });

  // ---- reject() ---------------------------------------------------

  it("reject() rejette une soumission et enregistre le motif", async () => {
    await submissionService.submit({
      type: "new",
      data: { firstName: "ARejeter", lastName: TEST_LAST_NAME },
    });

    const pending = await MemberSubmission.findOne({
      "data.lastName": TEST_LAST_NAME,
    }).lean();

    const rejected = await submissionService.reject(pending._id, {
      reason: "Motif de test",
      user: { id: new mongoose.Types.ObjectId() },
    });

    assert.equal(rejected.status, "rejected");
    assert.equal(rejected.rejectionReason, "Motif de test");
  });

  it("reject() lève une 409 sur une soumission déjà traitée", async () => {
    await submissionService.submit({
      type: "new",
      data: { firstName: "DejaTraite2", lastName: TEST_LAST_NAME },
    });

    const pending = await MemberSubmission.findOne({
      "data.lastName": TEST_LAST_NAME,
    }).lean();

    await submissionService.reject(pending._id, {
      reason: "Premier motif",
      user: { id: new mongoose.Types.ObjectId() },
    });

    await assert.rejects(
      submissionService.reject(pending._id, {
        reason: "Second motif",
        user: { id: new mongoose.Types.ObjectId() },
      }),
      (error) => error.status === 409
    );
  });

  it("reject() lève une 404 pour une soumission introuvable", async () => {
    await assert.rejects(
      submissionService.reject(new mongoose.Types.ObjectId(), {
        reason: "Motif",
        user: { id: new mongoose.Types.ObjectId() },
      }),
      (error) => error.status === 404
    );
  });
});
