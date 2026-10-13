import { describe, it } from "node:test";
import assert from "node:assert/strict";

import Media from "./Media.js";

// Test PUR : `validateSync()` n'ouvre aucune connexion. Rien à nettoyer
// dans la base de développement partagée — c'est le SCHÉMA qui est
// vérifié, pas la persistance.

const valid = (video = null) => ({
  title: "Marcher par la foi",
  author: "Équipe pastorale",
  category: "message",
  image: "/images/media/message1.jpg",
  video,
});

const videoError = (video) =>
  new Media(valid(video)).validateSync()?.errors ?? {};

describe("Media (modèle) — adresses vidéo", () => {
  it("accepte un média sans vidéo, un lien https et un fichier interne", () => {
    assert.equal(new Media(valid()).validateSync(), undefined);

    assert.equal(
      new Media(
        valid({ kind: "link", url: "https://youtube.com/@cava" })
      ).validateSync(),
      undefined
    );

    assert.equal(
      new Media(valid({ kind: "file", src: "/videos/culte.mp4" })).validateSync(),
      undefined
    );
  });

  it("refuse un lien externe qui n'est pas en http(s)", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "youtube.com/@cava",
    ]) {
      assert.ok(
        videoError({ kind: "link", url })["video.url"],
        `« ${url} » aurait dû être refusé`
      );
    }
  });

  it("refuse une source de fichier hors chemin interne ou https", () => {
    for (const src of [
      "javascript:alert(1)",
      "//autre-site.org/v.mp4",
      "http://exemple.org/v.mp4",
    ]) {
      assert.ok(
        videoError({ kind: "file", src })["video.src"],
        `« ${src} » aurait dû être refusé`
      );
    }
  });
});
