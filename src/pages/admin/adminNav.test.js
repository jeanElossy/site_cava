import { describe, expect, it } from "vitest";

import {
  NAV_GROUPS,
  findActiveEntry,
  searchNav,
  visibleNavGroups,
} from "./adminNav";

const labelsOf = (groups) =>
  groups.flatMap((group) => group.items.map((item) => item.label));

describe("visibleNavGroups", () => {
  it("donne tout le menu à l'administrateur", () => {
    const labels = labelsOf(visibleNavGroups("admin"));

    expect(labels).toContain("Agents");
    expect(labels).toContain("Types d'aide");
    // Réservé au responsable de bergerie, pas à l'admin.
    expect(labels).not.toContain("Mes membres");
  });

  it("ne montre au Service Social que son module et le tableau de bord", () => {
    const groups = visibleNavGroups("social_agent");

    expect(groups.map((group) => group.title)).toEqual([
      null,
      "Service Social",
    ]);
    expect(labelsOf(groups)).not.toContain("Types d'aide");
  });

  it("retire un groupe dont toutes les entrées sont filtrées", () => {
    const groups = visibleNavGroups("soa");

    expect(groups.map((group) => group.title)).toEqual([
      null,
      "Communauté",
    ]);
    expect(labelsOf(groups)).toEqual(["Tableau de bord", "Nouvelles âmes"]);
  });
});

describe("findActiveEntry", () => {
  const groups = visibleNavGroups("admin");

  it("préfère la correspondance la plus longue", () => {
    expect(findActiveEntry("/admin/dons/types", groups).item.label).toBe(
      "Types de don"
    );
    expect(findActiveEntry("/admin/dons", groups).item.label).toBe("Dons");
  });

  it("rattache une fiche à sa liste parente", () => {
    const found = findActiveEntry("/admin/nouvelles-ames/64f0a", groups);

    expect(found.item.label).toBe("Nouvelles âmes");
    expect(found.exact).toBe(false);
  });

  it("ne fait pas du tableau de bord le parent de toute l'admin", () => {
    expect(findActiveEntry("/admin/inconnu", groups)).toBeNull();
    expect(findActiveEntry("/admin/", groups).item.label).toBe(
      "Tableau de bord"
    );
  });
});

describe("searchNav", () => {
  const groups = visibleNavGroups("admin");

  it("ignore accents et casse, et cherche dans les mots-clés", () => {
    expect(searchNav("evenements", groups).map((e) => e.item.label)).toEqual([
      "Événements",
    ]);
    expect(searchNav("ECOLE", groups)[0].item.label).toBe("Tableau de bord");
  });

  it("exige chaque mot saisi", () => {
    const labels = searchNav("social caisse", groups).map((e) => e.item.label);

    expect(labels).toEqual(["Caisse"]);
  });

  it("renvoie tout quand la saisie est vide", () => {
    expect(searchNav("  ", groups)).toHaveLength(labelsOf(groups).length);
  });

  it("ne propose jamais une page interdite au rôle", () => {
    const labels = searchNav("agents", visibleNavGroups("editor")).map(
      (e) => e.item.label
    );

    expect(labels).not.toContain("Agents");
  });
});

it("chaque entrée a un chemin unique", () => {
  const paths = NAV_GROUPS.flatMap((group) => group.items.map((i) => i.to));

  expect(new Set(paths).size).toBe(paths.length);
});
