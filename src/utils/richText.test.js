import { describe, expect, it } from "vitest";

import { parseInline, parseRichText, toPlainText } from "./richText";

describe("parseRichText", () => {
  it("renvoie une liste vide pour un texte absent ou blanc", () => {
    expect(parseRichText(undefined)).toEqual([]);
    expect(parseRichText("   \n  ")).toEqual([]);
  });

  it("sépare les paragraphes sur les lignes vides et joint les lignes consécutives", () => {
    expect(parseRichText("Un\ndeux\n\nTrois")).toEqual([
      { type: "paragraph", text: "Un deux" },
      { type: "paragraph", text: "Trois" },
    ]);
  });

  it("reconnaît les titres et les listes", () => {
    expect(
      parseRichText("## Au programme\n* Les origines\n- Le dessein\n\nFin")
    ).toEqual([
      { type: "heading", text: "Au programme" },
      { type: "list", items: ["Les origines", "Le dessein"] },
      { type: "paragraph", text: "Fin" },
    ]);
  });

  it("ne prend pas une ligne en italique pour une puce", () => {
    expect(parseRichText("*Que dit Dieu ?*")).toEqual([
      { type: "paragraph", text: "*Que dit Dieu ?*" },
    ]);
  });

  it("garde le HTML saisi comme du texte", () => {
    expect(parseRichText("<script>alert(1)</script>")).toEqual([
      { type: "paragraph", text: "<script>alert(1)</script>" },
    ]);
  });
});

describe("parseInline", () => {
  it("découpe gras et italique", () => {
    expect(parseInline("Un **fort** et *doux* mot")).toEqual([
      { text: "Un " },
      { text: "fort", strong: true },
      { text: " et " },
      { text: "doux", em: true },
      { text: " mot" },
    ]);
  });

  it("laisse un astérisque orphelin intact", () => {
    expect(parseInline("5 * 3")).toEqual([{ text: "5 * 3" }]);
  });
});

describe("toPlainText", () => {
  it("retire les marques pour un aperçu", () => {
    expect(
      toPlainText("## Titre\n\n*Que dit Dieu ?*\n\n* un\n* deux")
    ).toBe("Titre Que dit Dieu ? un deux");
  });
});
