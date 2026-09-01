import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { request } from "./http";

// Normalisation `_id` → `id` des réponses de l'API.
//
// Elle ne portait que sur le premier niveau : une référence jointe — le
// membre d'une affectation, la classe d'une séance — n'avait jamais
// d'`id`. Les écrans envoyaient alors `undefined` à l'API, qui
// répondait « Identifiant invalide » sur un clic parfaitement légitime.
//
// Ces tests passent par `request` plutôt que par la fonction interne :
// c'est le contrat réellement offert aux écrans.
const jsonResponse = (data) => ({
  ok: true,
  status: 200,
  json: async () => ({ success: true, data }),
});

describe("http — normalisation des identifiants", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const call = async (data) => {
    globalThis.fetch.mockResolvedValue(jsonResponse(data));

    return request("/api/test");
  };

  it("ajoute `id` au premier niveau", async () => {
    const result = await call({ _id: "abc", name: "Classe" });

    expect(result.id).toBe("abc");
  });

  it("ajoute `id` à une référence JOINTE — la régression corrigée", async () => {
    const result = await call({
      _id: "assignment-1",
      member: { _id: "member-1", firstName: "Gisèle" },
      primaryClass: { _id: "class-1", name: "03 à 05 ans" },
    });

    expect(result.member.id).toBe("member-1");
    expect(result.primaryClass.id).toBe("class-1");
  });

  it("descend dans les tableaux imbriqués", async () => {
    const result = await call({
      _id: "session-1",
      children: [{ _id: "child-1" }, { _id: "child-2" }],
    });

    expect(result.children.map((item) => item.id)).toEqual([
      "child-1",
      "child-2",
    ]);
  });

  it("descend sur plusieurs niveaux", async () => {
    const result = await call({
      _id: "a",
      level2: { _id: "b", level3: { _id: "c" } },
    });

    expect(result.level2.level3.id).toBe("c");
  });

  it("ne touche pas à un `id` déjà présent", async () => {
    const result = await call({ _id: "brut", id: "deja-la" });

    expect(result.id).toBe("deja-la");
  });

  it("laisse intactes les valeurs qui ne sont pas des objets", async () => {
    const result = await call({
      _id: "a",
      // Une date sort de `response.json()` en CHAÎNE : la recopier
      // comme un objet la détruirait, d'où ce garde-fou.
      createdAt: "2026-09-01T10:00:00.000Z",
      count: 3,
      active: true,
      note: null,
    });

    expect(result.createdAt).toBe("2026-09-01T10:00:00.000Z");
    expect(result.count).toBe(3);
    expect(result.active).toBe(true);
    expect(result.note).toBeNull();
  });

  it("supporte une référence non peuplée (simple chaîne)", async () => {
    const result = await call({ _id: "a", member: "member-1" });

    expect(result.member).toBe("member-1");
  });
});
