import { readFileSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";

import { describe, it, expect } from "vitest";

// Cohérence entre les liens et les routes déclarées.
//
// ------------------------------------------------------------------
// POURQUOI CE TEST EXISTE
// ------------------------------------------------------------------
// Le module Enfants a été livré en production avec un bouton
// « Nouvel enfant » pointant vers `/admin/enfants/nouveau`, une route
// qui n'existait pas. React Router ne signale rien : l'URL est tombée
// sur `enfants/:id`, la fiche s'est ouverte avec `id = "nouveau"` et a
// affiché « Enfant introuvable ». Deux écrans portaient ce lien.
//
// Aucun test ne pouvait le voir : les suites du dépôt vérifient des
// règles métier, jamais qu'une navigation aboutit. Celui-ci lit le
// source plutôt que de monter l'application — il n'a besoin d'aucun
// rendu pour répondre à la seule question qui compte : ce lien mène-t-il
// quelque part ?
//
// Corollaire à garder en tête : déclarer les chemins LITTÉRAUX avant
// les chemins PARAMÉTRÉS. `enfants/nouveau` placé après `enfants/:id`
// passerait ce test tout en étant capté par la route paramétrée.

const ROUTE_FILES = ["src/routes/AdminRoutes.jsx", "src/routes/AppRoutes.jsx"];

const sourceFiles = (dir, acc = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) sourceFiles(full, acc);
    else if ([".js", ".jsx"].includes(extname(entry.name))) acc.push(full);
  }

  return acc;
};

// Les routes d'`AdminRoutes` sont relatives et rendues sous `/admin`.
const declaredRoutes = () => {
  const routes = new Set();

  for (const file of ROUTE_FILES) {
    const source = readFileSync(file, "utf8");

    for (const match of source.matchAll(/path="([^"]+)"/g)) {
      const path = match[1];

      routes.add(path.startsWith("/") ? path : `/admin/${path}`);
    }
  }

  return [...routes];
};

// Un lien ÉCRIT EN DUR doit correspondre à une route LITTÉRALE.
//
// C'est tout le sujet, et la première version de ce test s'y est
// trompée : elle laissait un segment `:param` absorber n'importe quoi,
// si bien que `/admin/enfants/nouveau` était « trouvé » par
// `enfants/:id` — exactement le mécanisme du bug. Un test qui accepte
// la panne qu'il est censé détecter ne vaut rien.
//
// Les liens réellement dynamiques sont construits par gabarit
// (`` `/admin/enfants/${id}` ``) et ne sont pas examinés ici : leur
// cible n'existe qu'à l'exécution.
const matches = (target, routes) => {
  const clean = target.split("?")[0].split("#")[0].replace(/\/$/, "") || "/";

  return routes.some((route) => {
    const normalized = (route.replace(/\/$/, "") || "/").split("/");

    if (normalized.some((segment) => segment.startsWith(":"))) return false;

    return normalized.join("/") === clean;
  });
};

describe("liens internes et routes déclarées", () => {
  it("aucun lien ne pointe vers une route inexistante", () => {
    const routes = declaredRoutes();

    expect(routes.length).toBeGreaterThan(10);

    const dead = [];

    for (const file of sourceFiles("src")) {
      if (ROUTE_FILES.includes(file)) continue;

      // Les fichiers de test sont exclus, celui-ci en premier : ses
      // propres expressions régulières contiennent « to= » et
      // « navigate( » et se feraient prendre pour des liens.
      if (/\.test\.[jt]sx?$/.test(file)) continue;

      const source = readFileSync(file, "utf8");

      // `to="/…"` des <Link>, et `navigate("/…")`. Les cibles
      // construites (`${id}`) sont ignorées : leur forme dépend de
      // l'exécution, pas du source.
      const targets = [
        ...source.matchAll(/(?:to|navigate\()\s*=?\s*"(\/[^"]*)"/g),
      ].map((match) => match[1]);

      for (const target of targets) {
        if (target.startsWith("/api")) continue;

        if (!matches(target, routes)) dead.push(`${file} → ${target}`);
      }
    }

    expect(dead).toEqual([]);
  });
});
