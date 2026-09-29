import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isProfileComplete,
  missingProfileLabels,
  profileCompletion,
  PROFILE_FIELDS,
  TOTAL_PROFILE_FIELDS,
} from "./memberProfileAudit.service.js";

// Logique PURE : aucun accès à MongoDB, donc aucun nettoyage à prévoir
// et aucun risque pour la base de développement partagée.

// Fiche entièrement remplie, servant de point de départ : chaque test
// n'en retire QUE le champ qu'il examine, ce qui garantit que
// l'assertion porte bien sur ce champ et pas sur un oubli du gabarit.
const completeMember = () => ({
  firstName: "Awa",
  lastName: "Kone",
  registrationNumber: "1ME19016P",
  flock: "665f1c2d4e5a6b7c8d9e0f11",
  photo: "https://res.cloudinary.com/demo/image/upload/membres/awa.jpg",
  dateOfBirth: new Date("1992-03-14"),
  gender: "femme",
  maritalStatus: "marie",
  childrenCount: 2,
  conversionYear: 2012,
  baptism: { water: true, waterYear: 2013, holySpirit: true },
  profession: "Sage-femme",
  skills: ["Santé", "Accueil"],
  desiredDepartment: "Accueil",
  availability: "Dimanche matin",
  phone: "+225 07 00 00 00 00",
  whatsapp: "+225 07 00 00 00 00",
  email: "awa@example.invalid",
  area: "Cocody",
  emergencyContact: { name: "Yao K.", phone: "+225 05 00 00 00 00" },
});

describe("memberProfileAudit.service", () => {
  it("ne signale aucun champ manquant sur une fiche entièrement remplie", () => {
    const member = completeMember();

    assert.deepEqual(missingProfileLabels(member), []);
    assert.equal(isProfileComplete(member), true);
    assert.equal(profileCompletion(member), 100);
  });

  it("signale chaque champ suivi lorsqu'il est absent, un par un", () => {
    // Parcourt la liste réelle plutôt qu'une copie : un champ ajouté à
    // `PROFILE_FIELDS` sans règle de détection correcte fait échouer ce
    // test au lieu de passer inaperçu.
    for (const field of PROFILE_FIELDS) {
      const member = completeMember();

      switch (field.key) {
        case "baptism":
          member.baptism = {};
          break;
        case "baptismWaterYear":
          member.baptism = { water: true, holySpirit: true };
          break;
        case "emergencyContactName":
          member.emergencyContact = { phone: "+225 05 00 00 00 00" };
          break;
        case "emergencyContactPhone":
          member.emergencyContact = { name: "Yao K." };
          break;
        case "skills":
          member.skills = [];
          break;
        default:
          delete member[field.key];
      }

      assert.deepEqual(
        missingProfileLabels(member),
        [field.label],
        `Le champ « ${field.label} » (${field.key}) n'est pas détecté comme manquant.`
      );
    }
  });

  it("compte 0 enfant comme une réponse, pas comme un champ vide", () => {
    // `if (member.childrenCount)` aurait rangé toutes les familles sans
    // enfant parmi les fiches à relancer — c'est exactement le piège
    // que la règle de détection évite.
    const member = { ...completeMember(), childrenCount: 0 };

    assert.deepEqual(missingProfileLabels(member), []);
  });

  it("traite une chaîne d'espaces comme un champ vide", () => {
    const member = { ...completeMember(), profession: "   " };

    assert.deepEqual(missingProfileLabels(member), ["Profession"]);
  });

  it("ne réclame l'année du baptême d'eau qu'aux membres déclarés baptisés", () => {
    const pasBaptise = completeMember();

    pasBaptise.baptism = { water: false, holySpirit: true };

    assert.deepEqual(missingProfileLabels(pasBaptise), []);

    const baptiseSansAnnee = completeMember();

    baptiseSansAnnee.baptism = { water: true, holySpirit: true };

    assert.deepEqual(missingProfileLabels(baptiseSansAnnee), [
      "Année du baptême d'eau",
    ]);
  });

  it("ne signale le bloc baptêmes que s'il n'a jamais été touché", () => {
    // `water: false` seul est ambigu (« pas baptisé » ou « pas
    // renseigné ») : on ne le compte pas comme un manque tant qu'une
    // autre valeur du bloc a été renseignée.
    const holySpiritSeul = completeMember();

    holySpiritSeul.baptism = { water: false, holySpirit: true };

    assert.equal(
      missingProfileLabels(holySpiritSeul).includes(
        "Baptêmes (eau / Saint-Esprit)"
      ),
      false
    );

    const vierge = completeMember();

    vierge.baptism = undefined;

    assert.equal(
      missingProfileLabels(vierge).includes("Baptêmes (eau / Saint-Esprit)"),
      true
    );
  });

  it("calcule un taux de complétude cohérent avec le nombre de champs suivis", () => {
    const member = completeMember();

    delete member.profession;
    delete member.area;

    assert.equal(missingProfileLabels(member).length, 2);
    assert.equal(
      profileCompletion(member),
      Math.round(((TOTAL_PROFILE_FIELDS - 2) / TOTAL_PROFILE_FIELDS) * 100)
    );
  });

  it("n'expose aucune clé de champ en double", () => {
    const keys = PROFILE_FIELDS.map((field) => field.key);

    assert.equal(new Set(keys).size, keys.length);
  });
});
