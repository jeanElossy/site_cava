import { describe, expect, it } from "vitest";

import { safeHttpUrl, safeMediaSrc } from "./safeUrl";

describe("safeHttpUrl", () => {
  it("accepte http et https", () => {
    expect(safeHttpUrl("https://youtube.com/@cava")).toBe(
      "https://youtube.com/@cava"
    );
    expect(safeHttpUrl("  http://exemple.org/a  ")).toBe(
      "http://exemple.org/a"
    );
  });

  it("refuse les protocoles dangereux et retombe sur le repli", () => {
    expect(safeHttpUrl("javascript:alert(1)", "/media")).toBe("/media");
    expect(safeHttpUrl("JavaScript:alert(1)", "/media")).toBe("/media");
    expect(safeHttpUrl("data:text/html,<script>", "/media")).toBe("/media");
    expect(safeHttpUrl("vbscript:msgbox", null)).toBeNull();
  });

  it("refuse une valeur vide ou mal formée", () => {
    expect(safeHttpUrl("", "x")).toBe("x");
    expect(safeHttpUrl("pas une url", "x")).toBe("x");
    expect(safeHttpUrl(undefined)).toBeNull();
  });
});

describe("safeMediaSrc", () => {
  it("accepte un chemin interne et une adresse https", () => {
    expect(safeMediaSrc("/videos/culte.mp4")).toBe("/videos/culte.mp4");
    expect(safeMediaSrc("https://res.cloudinary.com/x/v.mp4")).toBe(
      "https://res.cloudinary.com/x/v.mp4"
    );
  });

  it("refuse http, les protocoles dangereux et le relatif au protocole", () => {
    expect(safeMediaSrc("http://exemple.org/v.mp4")).toBeNull();
    expect(safeMediaSrc("javascript:alert(1)")).toBeNull();
    expect(safeMediaSrc("//autre-site.org/v.mp4")).toBeNull();
  });
});
