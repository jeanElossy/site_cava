import { describe, it, expect } from "vitest";

import { allocateAcrossMonths } from "./socialShared";

// Répartition d'un montant global sur les mois dus — le calcul d'argent
// de l'écran Offrandes (voir SocialContributionsAdmin.jsx#applySpread).
// Testé isolément parce qu'une erreur ici se traduit directement par une
// dette mal soldée.

const mois = (year, month, owed) => ({ key: `${year}-${month}`, year, month, owed });

describe("allocateAcrossMonths", () => {
  it("solde les mois du plus ancien au plus récent", () => {
    const { parts, left } = allocateAcrossMonths(
      [mois(2026, 3, 1000), mois(2026, 1, 1000), mois(2026, 2, 1000)],
      3000
    );

    expect(parts.map((p) => p.month)).toEqual([1, 2, 3]);
    expect(parts.every((p) => p.part === 1000)).toBe(true);
    expect(parts.every((p) => p.partial)).toBe(false);
    expect(left).toBe(0);
  });

  it("s'arrête quand le montant est épuisé, sans toucher aux mois suivants", () => {
    const { parts, left } = allocateAcrossMonths(
      [mois(2026, 1, 1000), mois(2026, 2, 1000), mois(2026, 3, 1000)],
      2000
    );

    expect(parts).toHaveLength(2);
    expect(parts.map((p) => p.month)).toEqual([1, 2]);
    expect(left).toBe(0);
  });

  it("marque partiel le dernier mois insuffisamment couvert", () => {
    const { parts, left } = allocateAcrossMonths(
      [mois(2026, 1, 1000), mois(2026, 2, 1000)],
      1500
    );

    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatchObject({ month: 1, part: 1000, partial: false });
    expect(parts[1]).toMatchObject({ month: 2, part: 500, partial: true });
    expect(left).toBe(0);
  });

  it("tient compte de ce qui a DÉJÀ été versé sur un mois partiel", () => {
    // 400 restent dus sur janvier : 1 000 doivent couvrir janvier puis
    // entamer février, pas repayer janvier en entier.
    const { parts, left } = allocateAcrossMonths(
      [mois(2026, 1, 400), mois(2026, 2, 1000)],
      1000
    );

    expect(parts[0]).toMatchObject({ month: 1, part: 400 });
    expect(parts[1]).toMatchObject({ month: 2, part: 600, partial: true });
    expect(left).toBe(0);
  });

  it("renvoie le reliquat sans le placer d'office sur le dernier mois", () => {
    // C'est le point de conception : 5 000 F pour deux mois dus laissent
    // 3 000 F que le responsable doit poser lui-même, en connaissance de
    // ce dont il a convenu avec le membre.
    const { parts, left } = allocateAcrossMonths(
      [mois(2026, 1, 1000), mois(2026, 2, 1000)],
      5000
    );

    expect(parts).toHaveLength(2);
    expect(parts.every((p) => p.part === 1000)).toBe(true);
    expect(left).toBe(3000);
  });

  it("ignore les mois qui ne doivent plus rien", () => {
    const { parts } = allocateAcrossMonths(
      [mois(2026, 1, 0), mois(2026, 2, 1000)],
      1000
    );

    expect(parts).toHaveLength(1);
    expect(parts[0].month).toBe(2);
  });

  it("n'affecte rien pour un montant absent, nul ou négatif", () => {
    for (const montant of [0, -100, undefined, null, "", "abc"]) {
      const { parts, left } = allocateAcrossMonths([mois(2026, 1, 1000)], montant);

      expect(parts).toEqual([]);
      expect(left).toBe(0);
    }
  });

  it("ne rend rien quand aucun mois n'est dû", () => {
    expect(allocateAcrossMonths([], 5000)).toEqual({ parts: [], left: 5000 });
  });
});
