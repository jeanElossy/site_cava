import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { env } from "../config/env.js";
import { isTrustedMemberPhotoUrl } from "./cloudinaryUrl.js";

// Fonction pure : aucune base de données nécessaire. Construit l'URL
// valide à partir du `CLOUDINARY_CLOUD_NAME` réellement configuré
// plutôt que d'en coder un en dur, qui différerait d'un environnement
// à l'autre.
const validUrl = `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/v1700000000/cava/members/abc123.jpg`;

describe("cloudinaryUrl — isTrustedMemberPhotoUrl", () => {
  it("accepte une URL Cloudinary de notre compte, dans le dossier membres", () => {
    assert.equal(isTrustedMemberPhotoUrl(validUrl), true);
  });

  it("refuse une valeur vide, nulle ou non-chaîne", () => {
    assert.equal(isTrustedMemberPhotoUrl(""), false);
    assert.equal(isTrustedMemberPhotoUrl(null), false);
    assert.equal(isTrustedMemberPhotoUrl(undefined), false);
  });

  it("refuse une chaîne qui n'est pas une URL valide", () => {
    assert.equal(isTrustedMemberPhotoUrl("pas-une-url"), false);
  });

  // Le cas concret qui a motivé cette validation : le serveur
  // (memberCardSvg.service.js) récupère lui-même cette URL — la laisser
  // pointer vers un service interne ou des métadonnées cloud serait
  // une SSRF.
  it("refuse une adresse interne ou locale (SSRF)", () => {
    assert.equal(isTrustedMemberPhotoUrl("http://169.254.169.254/latest/meta-data/"), false);
    assert.equal(isTrustedMemberPhotoUrl("http://localhost:4000/secret"), false);
    assert.equal(isTrustedMemberPhotoUrl("file:///etc/passwd"), false);
  });

  it("refuse http (non chiffré), même vers le bon hôte", () => {
    assert.equal(
      isTrustedMemberPhotoUrl(validUrl.replace("https://", "http://")),
      false
    );
  });

  it("refuse un autre compte Cloudinary que le nôtre", () => {
    assert.equal(
      isTrustedMemberPhotoUrl(
        "https://res.cloudinary.com/un-autre-compte/image/upload/cava/members/x.jpg"
      ),
      false
    );
  });

  it("refuse un dossier Cloudinary autre que cava/members (ex. medias, ministries)", () => {
    assert.equal(
      isTrustedMemberPhotoUrl(
        `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/cava/medias/x.jpg`
      ),
      false
    );
  });

  it("refuse un domaine qui ressemble à Cloudinary mais n'en est pas un", () => {
    assert.equal(
      isTrustedMemberPhotoUrl(
        "https://res.cloudinary.com.evil.example/x/image/upload/cava/members/x.jpg"
      ),
      false
    );
  });
});
