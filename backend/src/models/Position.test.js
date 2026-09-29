import { describe, it } from "node:test";
import assert from "node:assert/strict";

import Position from "./Position.js";

// Test PUR : `validateSync()` n'ouvre aucune connexion. Il n'y a donc
// rien à nettoyer, et rien à craindre pour la base de développement
// partagée — ce qui est vérifié ici est le SCHÉMA, pas la persistance.

const valid = () => ({
  slug: "secretariat-executif",
  title: "Secrétariat exécutif",
  subtitle: "Équipe à constituer",
  variant: "dark",
  icon: "secretariat",
  missions: [{ value: "Rédiger les comptes rendus des réunions." }],
  requirements: [{ value: "Maîtriser l'expression écrite." }],
});

describe("Position (modèle)", () => {
  it("accepte un poste complet", () => {
    assert.equal(new Position(valid()).validateSync(), undefined);
  });

  it("exige un intitulé", () => {
    const doc = new Position({ ...valid(), title: undefined });

    assert.match(
      doc.validateSync()?.errors?.title?.message ?? "",
      /obligatoire/i
    );
  });

  it("met le slug en minuscules au lieu de refuser une majuscule", () => {
    // `lowercase: true` s'applique AVANT la validation : une majuscule
    // saisie depuis l'administration est donc normalisée en silence,
    // pas rejetée. Comportement volontaire, repris du modèle Ministry —
    // il évite de renvoyer une erreur pour une faute de frappe sans
    // conséquence. Le test l'acte pour qu'un futur durcissement du
    // schéma soit un choix, pas une surprise.
    const doc = new Position({ ...valid(), slug: "Secretariat-Executif" });

    assert.equal(doc.slug, "secretariat-executif");
    assert.equal(doc.validateSync()?.errors?.slug, undefined);
  });

  it("refuse un slug contenant un espace ou un accent", () => {
    // Ceux-là, en revanche, casseraient l'adresse
    // /appel-a-candidature/<slug>.
    for (const slug of ["deux mots", "délivrance"]) {
      const doc = new Position({ ...valid(), slug });

      assert.ok(
        doc.validateSync()?.errors?.slug,
        `Le slug « ${slug} » aurait dû être refusé.`
      );
    }
  });

  it("refuse une variante ou une icône hors énumération", () => {
    // Une valeur libre ne provoquerait aucune erreur d'affichage : la
    // carte resterait simplement sans fond, et son icône blanche
    // deviendrait invisible. Le refus au modèle est la seule barrière.
    assert.ok(
      new Position({ ...valid(), variant: "bleu" }).validateSync()?.errors
        ?.variant
    );

    assert.ok(
      new Position({ ...valid(), icon: "fusee" }).validateSync()?.errors?.icon
    );
  });

  it("applique les valeurs par défaut attendues", () => {
    const doc = new Position({ slug: "test", title: "Test" });

    assert.equal(doc.status, "published");
    assert.equal(doc.variant, "light");
    assert.equal(doc.order, 0);
    assert.deepEqual(doc.missions, []);
    assert.deepEqual(doc.requirements, []);
  });

  it("borne les listes à quinze éléments", () => {
    const missions = Array.from({ length: 16 }, (_, i) => ({
      value: `Mission ${i}`,
    }));

    assert.match(
      new Position({ ...valid(), missions }).validateSync()?.errors?.missions
        ?.message ?? "",
      /15 missions maximum/
    );
  });

  it("exige un texte sur chaque ligne de liste", () => {
    // Le champ répétable de l'administration crée une ligne VIDE avant
    // qu'on la remplisse : l'enregistrer telle quelle produirait une
    // puce blanche sur la fiche publique.
    assert.ok(
      new Position({ ...valid(), missions: [{ value: "" }] }).validateSync()
    );
  });
});
