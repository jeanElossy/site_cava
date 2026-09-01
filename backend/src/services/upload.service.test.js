import { describe, it } from "node:test";
import assert from "node:assert/strict";

import * as uploadService from "./upload.service.js";

// Fonctions pures (signature HMAC) : aucune base de données, aucun
// appel réseau. Les tests portent sur ce que le serveur ACCEPTE de
// signer — c'est-à-dire sur la seule barrière réelle, puisque le
// navigateur envoie ensuite directement à Cloudinary.

const admin = { role: "admin" };
const responsable = { role: "responsable_ecole_dimanche" };
const moniteur = { role: "moniteur" };
const editor = { role: "editor" };

describe("upload.service — dossiers restreints par rôle", () => {
  it("un admin peut signer un envoi de document d'enfant", () => {
    const data = uploadService.createSignature({
      folder: "childrenDocuments",
      user: admin,
    });

    assert.equal(data.folder, "cava/children-documents");
  });

  it("le responsable de l'École du dimanche le peut aussi", () => {
    const data = uploadService.createSignature({
      folder: "childrenDocuments",
      user: responsable,
    });

    assert.equal(data.folder, "cava/children-documents");
  });

  it("un MONITEUR ne peut pas déposer de document d'enfant", () => {
    assert.throws(
      () =>
        uploadService.createSignature({
          folder: "childrenDocuments",
          user: moniteur,
        }),
      /ne permet pas de déposer/
    );
  });

  it("un editor non plus — la route n'exige pourtant que d'être authentifié", () => {
    assert.throws(
      () =>
        uploadService.createSignature({
          folder: "childrenDocuments",
          user: editor,
        }),
      /ne permet pas de déposer/
    );
  });

  it("un appel sans utilisateur est refusé sur un dossier restreint", () => {
    assert.throws(
      () => uploadService.createSignature({ folder: "childrenDocuments" }),
      /ne permet pas de déposer/
    );
  });

  it("les dossiers historiques restent ouverts à tout compte authentifié", () => {
    // Comportement d'avant le module Enfants, volontairement inchangé.
    const data = uploadService.createSignature({ folder: "medias", user: editor });

    assert.equal(data.folder, "cava/medias");
  });

  it("la route publique d'inscription reste inchangée (aucun utilisateur, dossier imposé)", () => {
    const data = uploadService.createSignature({ folder: "members" });

    assert.equal(data.folder, "cava/members");
  });

  it("un dossier inconnu retombe sur « divers » sans jamais atteindre un dossier restreint", () => {
    const data = uploadService.createSignature({
      folder: "../children-documents",
      user: editor,
    });

    assert.equal(data.folder, "cava/divers");
  });
});

describe("upload.service — mode de livraison protégé", () => {
  it("les documents d'enfants sont signés en mode « authenticated »", () => {
    const data = uploadService.createSignature({
      folder: "childrenDocuments",
      user: admin,
    });

    assert.equal(data.type, "authenticated");
  });

  it("les autres dossiers restent en mode public (aucun type imposé)", () => {
    const medias = uploadService.createSignature({ folder: "medias", user: admin });
    const photos = uploadService.createSignature({ folder: "children", user: admin });

    assert.equal(medias.type, undefined);
    assert.equal(photos.type, undefined);
  });

  it("les formats acceptés sont signés, donc opposables au navigateur", () => {
    const data = uploadService.createSignature({
      folder: "childrenDocuments",
      user: admin,
    });

    assert.equal(data.allowedFormats, "pdf,jpg,jpeg,png");
  });

  it("changer le mode ou les formats change la signature", () => {
    // Garantit que `type` et `allowed_formats` entrent RÉELLEMENT dans
    // le calcul : si un jour ils en sortaient, un client pourrait les
    // modifier sans que Cloudinary s'en aperçoive.
    const documents = uploadService.createSignature({
      folder: "childrenDocuments",
      user: admin,
    });

    const medias = uploadService.createSignature({ folder: "medias", user: admin });

    assert.notEqual(documents.signature, medias.signature);
  });
});

describe("upload.service — lien de consultation d'un document protégé", () => {
  it("produit une URL signée ET datée", () => {
    const { url, expiresAt } = uploadService.createPrivateDownloadUrl({
      publicId: "cava/children-documents/abc123",
      format: "pdf",
      resourceType: "image",
    });

    assert.ok(url.startsWith("https://api.cloudinary.com/v1_1/"));
    assert.ok(url.includes("signature="));
    assert.ok(url.includes("expires_at="));
    assert.ok(url.includes("type=authenticated"));
    assert.ok(expiresAt instanceof Date);
  });

  it("expire par défaut en 5 minutes — un lien retrouvé plus tard ne sert plus", () => {
    const { expiresAt } = uploadService.createPrivateDownloadUrl({
      publicId: "cava/children-documents/abc123",
      format: "pdf",
    });

    const seconds = Math.round((expiresAt.getTime() - Date.now()) / 1000);

    assert.ok(seconds > 290 && seconds <= 300, `attendu ~300 s, obtenu ${seconds}`);
  });

  it("deux fichiers différents ne partagent jamais la même signature", () => {
    const a = uploadService.createPrivateDownloadUrl({
      publicId: "cava/children-documents/aaa",
      format: "pdf",
    });

    const b = uploadService.createPrivateDownloadUrl({
      publicId: "cava/children-documents/bbb",
      format: "pdf",
    });

    assert.notEqual(a.url, b.url);
  });

  it("refuse de produire un lien sans identifiant de fichier", () => {
    assert.throws(
      () => uploadService.createPrivateDownloadUrl({}),
      /introuvable/
    );
  });
});
