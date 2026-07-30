import { describe, it, expect } from "vitest";

import { initialState } from "../../../context/RegistrationContext";
import {
  validateStep,
  buildSubmissionPayload,
  memberToFormData,
} from "./data";

// État de base réutilisé et complété par chaque test, pour ne pas
// répéter toute la forme de `initialState` à chaque cas.
const baseState = () => ({
  ...initialState,
  data: { ...initialState.data },
});

describe("validateStep", () => {
  it("étape 0 (Matricule) : bloque une mise à jour sans matricule saisi", () => {
    const state = { ...baseState(), kind: "update" };

    expect(validateStep(0, state)).toBe(
      "Merci de saisir votre matricule."
    );
  });

  it("étape 0 (Matricule) : bloque une mise à jour sans nom de famille, même avec un matricule saisi", () => {
    const state = {
      ...baseState(),
      kind: "update",
      submittedRegistrationNumber: "1OL16005E",
    };

    expect(validateStep(0, state)).toBe(
      "Merci d'indiquer votre nom de famille, pour retrouver votre fiche."
    );
  });

  it("étape 0 (Matricule) : passe pour une mise à jour avec matricule ET nom de famille saisis", () => {
    const state = {
      ...baseState(),
      kind: "update",
      submittedRegistrationNumber: "1OL16005E",
    };
    state.data.lastName = "Kouassi";

    expect(validateStep(0, state)).toBe("");
  });

  it("étape 0 (Matricule) : passe toujours pour une nouvelle inscription", () => {
    const state = { ...baseState(), kind: "new" };

    expect(validateStep(0, state)).toBe("");
  });

  it("étape 1 (Identité) : exige le prénom", () => {
    const state = baseState();
    state.data.lastName = "Kouassi";
    state.data.church = "1";
    state.data.flock = "flock-id";

    expect(validateStep(1, state)).toBe("Merci d'indiquer votre prénom.");
  });

  it("étape 1 (Identité) : exige le nom", () => {
    const state = baseState();
    state.data.firstName = "Jean";
    state.data.church = "1";
    state.data.flock = "flock-id";

    expect(validateStep(1, state)).toBe("Merci d'indiquer votre nom.");
  });

  it("étape 1 (Identité) : exige l'église", () => {
    const state = baseState();
    state.data.firstName = "Jean";
    state.data.lastName = "Kouassi";
    state.data.flock = "flock-id";

    expect(validateStep(1, state)).toBe("Merci de choisir votre église.");
  });

  it("étape 1 (Identité) : exige la bergerie", () => {
    const state = baseState();
    state.data.firstName = "Jean";
    state.data.lastName = "Kouassi";
    state.data.church = "1";

    expect(validateStep(1, state)).toBe("Merci de choisir votre bergerie.");
  });

  it("étape 1 (Identité) : passe quand tous les champs requis sont remplis", () => {
    const state = baseState();
    state.data.firstName = "Jean";
    state.data.lastName = "Kouassi";
    state.data.church = "1";
    state.data.flock = "flock-id";

    expect(validateStep(1, state)).toBe("");
  });

  it("étape 2 (Contact) : exige le téléphone", () => {
    const state = baseState();

    expect(validateStep(2, state)).toBe(
      "Merci d'indiquer un numéro de téléphone."
    );
  });

  it("étape 2 (Contact) : passe avec un téléphone renseigné", () => {
    const state = baseState();
    state.data.phone = "0700000000";

    expect(validateStep(2, state)).toBe("");
  });

  it("étapes suivantes (3 à 6) : aucune validation bloquante", () => {
    const state = baseState();

    expect(validateStep(3, state)).toBe("");
    expect(validateStep(4, state)).toBe("");
    expect(validateStep(5, state)).toBe("");
    expect(validateStep(6, state)).toBe("");
  });
});

describe("buildSubmissionPayload", () => {
  it("construit le payload d'une nouvelle inscription (type 'new')", () => {
    const state = baseState();
    state.kind = "new";
    state.data.firstName = "  Jean  ";
    state.data.lastName = "  Kouassi  ";
    state.data.church = "1";
    state.data.flock = "flock-id";
    state.data.phone = "0700000000";

    const payload = buildSubmissionPayload(state);

    expect(payload.type).toBe("new");
    expect(payload.registrationNumber).toBeUndefined();
    expect(payload.data.firstName).toBe("Jean");
    expect(payload.data.lastName).toBe("Kouassi");
    expect(payload.data.church).toBe(1);
    expect(payload.data.flock).toBe("flock-id");
  });

  it("normalise le matricule pour une mise à jour (type 'update')", () => {
    const state = baseState();
    state.kind = "update";
    state.submittedRegistrationNumber = "1ol 16-005 e";

    const payload = buildSubmissionPayload(state);

    expect(payload.type).toBe("update");
    expect(payload.registrationNumber).toBe("1OL16005E");
  });

  it("scinde les compétences séparées par des virgules et retire les espaces", () => {
    const state = baseState();
    state.data.skills = "musique,  informatique ,accueil";

    const payload = buildSubmissionPayload(state);

    expect(payload.data.skills).toEqual([
      "musique",
      "informatique",
      "accueil",
    ]);
  });

  it("renvoie un tableau vide de compétences quand le champ est vide", () => {
    const state = baseState();
    state.data.skills = "";

    const payload = buildSubmissionPayload(state);

    expect(payload.data.skills).toEqual([]);
  });

  it("convertit les champs numériques et laisse `undefined` quand ils sont vides", () => {
    const state = baseState();
    state.data.childrenCount = "3";
    state.data.conversionYear = "2020";

    const payload = buildSubmissionPayload(state);

    expect(payload.data.childrenCount).toBe(3);
    expect(payload.data.conversionYear).toBe(2020);

    const emptyState = baseState();
    const emptyPayload = buildSubmissionPayload(emptyState);

    expect(emptyPayload.data.childrenCount).toBeUndefined();
    expect(emptyPayload.data.conversionYear).toBeUndefined();
  });

  it("structure les informations de baptême sous `baptism`", () => {
    const state = baseState();
    state.data.baptismWater = true;
    state.data.baptismWaterYear = "2019";
    state.data.baptismHolySpirit = false;

    const payload = buildSubmissionPayload(state);

    expect(payload.data.baptism).toEqual({
      water: true,
      waterYear: 2019,
      holySpirit: false,
    });
  });

  it("structure le contact d'urgence sous `emergencyContact`", () => {
    const state = baseState();
    state.data.emergencyContactName = "  Marie Koffi  ";
    state.data.emergencyContactPhone = " 0708000000 ";

    const payload = buildSubmissionPayload(state);

    expect(payload.data.emergencyContact).toEqual({
      name: "Marie Koffi",
      phone: "0708000000",
    });
  });

  it("laisse `dateOfBirth`, `gender` et `maritalStatus` à `undefined` quand ils sont vides", () => {
    const state = baseState();

    const payload = buildSubmissionPayload(state);

    expect(payload.data.dateOfBirth).toBeUndefined();
    expect(payload.data.gender).toBeUndefined();
    expect(payload.data.maritalStatus).toBeUndefined();
  });

  it("inclut `area` (quartier / groupe de maison), sans espaces superflus", () => {
    const state = baseState();
    state.data.area = "  Angré 7e tranche  ";

    const payload = buildSubmissionPayload(state);

    expect(payload.data.area).toBe("Angré 7e tranche");
  });

  it("convertit `arrivalYear` en nombre, et laisse `undefined` quand il est vide", () => {
    const state = baseState();
    state.data.arrivalYear = "2021";

    const payload = buildSubmissionPayload(state);

    expect(payload.data.arrivalYear).toBe(2021);

    const emptyPayload = buildSubmissionPayload(baseState());

    expect(emptyPayload.data.arrivalYear).toBeUndefined();
  });
});

describe("memberToFormData", () => {
  it("ne renvoie que les champs présents sur la fiche, sans écraser le reste avec des valeurs vides", () => {
    const patch = memberToFormData({
      firstName: "Jean",
      lastName: "Kouassi",
    });

    expect(patch).toEqual({ firstName: "Jean", lastName: "Kouassi" });
  });

  it("renvoie un correctif vide quand la fiche est vide", () => {
    expect(memberToFormData({})).toEqual({});
    expect(memberToFormData()).toEqual({});
  });

  it("convertit `church` en chaîne (les champs de formulaire sont des <select> texte)", () => {
    const patch = memberToFormData({ church: 3 });

    expect(patch.church).toBe("3");
  });

  it("aplati `emergencyContact` en `emergencyContactName` / `emergencyContactPhone`", () => {
    const patch = memberToFormData({
      emergencyContact: { name: "Marie Koffi", phone: "0708000000" },
    });

    expect(patch).toEqual({
      emergencyContactName: "Marie Koffi",
      emergencyContactPhone: "0708000000",
    });
  });

  it("tronque `dateOfBirth` au format AAAA-MM-JJ attendu par <input type='date'>", () => {
    const patch = memberToFormData({
      dateOfBirth: "1990-05-12T00:00:00.000Z",
    });

    expect(patch.dateOfBirth).toBe("1990-05-12");
  });

  it("convertit `childrenCount` et `conversionYear` en chaînes", () => {
    const patch = memberToFormData({ childrenCount: 2, conversionYear: 2015 });

    expect(patch.childrenCount).toBe("2");
    expect(patch.conversionYear).toBe("2015");
  });

  it("aplatit `baptism` en `baptismWater` / `baptismWaterYear` / `baptismHolySpirit`", () => {
    const patch = memberToFormData({
      baptism: { water: true, waterYear: 2018, holySpirit: false },
    });

    expect(patch).toEqual({
      baptismWater: true,
      baptismWaterYear: "2018",
      baptismHolySpirit: false,
    });
  });

  it("joint `skills` (tableau) en chaîne séparée par des virgules", () => {
    const patch = memberToFormData({
      skills: ["musique", "informatique", "accueil"],
    });

    expect(patch.skills).toBe("musique, informatique, accueil");
  });

  it("ignore `skills` quand ce n'est pas un tableau", () => {
    const patch = memberToFormData({ skills: null });

    expect(patch.skills).toBeUndefined();
  });

  it("reprend `area` (quartier / groupe de maison) tel quel", () => {
    const patch = memberToFormData({ area: "Angré 7e tranche" });

    expect(patch.area).toBe("Angré 7e tranche");
  });

  it("déduit `arrivalYear` de `joinedAt` (le formulaire ne redemande que l'année)", () => {
    const patch = memberToFormData({
      joinedAt: "2021-03-15T00:00:00.000Z",
    });

    expect(patch.arrivalYear).toBe("2021");
  });
});
