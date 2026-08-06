import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync } from "node:fs";

import { createCanvas, loadImage } from "@napi-rs/canvas";
import QRCode from "qrcode";
import PDFDocument from "pdfkit";

import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import {
  rewriteFontFamilies,
  reflowMultiTspanText,
  parseSvgDocument,
  serializeSvg,
  requireElementById,
  setElementImageSource,
  toDataUri,
  rasterizeSvgToPng,
} from "./svgCardRenderer.js";

// Badges invités pré-imprimés (homme/femme), affichés à l'accueil et
// scannés par l'agent de service d'ordre pour compter la présence —
// voir presence.service.js#parseGuestBadgeCode pour la reconnaissance
// au scan. Même principe que memberCardSvg.service.js : ce module ne
// fait QUE remplacer le QR (id `field-qr`) dans les gabarits fournis,
// rien d'autre n'est déplacé, redimensionné ou recoloré.
//
// CONTRAT D'ID des gabarits (public/carte_invites/homme.svg,
// femme.svg) :
//   field-qr   image (ou rect placeholder) — QR code du badge
const BADGES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../public/carte_invites"
);

const GENDERS = [
  { code: "HOMME", fileName: "homme.svg" },
  { code: "FEMME", fileName: "femme.svg" },
];
const BADGES_PER_GENDER = 5;

// La régression de qualité constatée (texte/logo flous) venait de la
// RÉENCODAGE EN JPEG ci-dessous, pas de l'échelle : sur du texte à
// bords nets (contrairement à une photo), la compression JPEG écrasait
// visiblement le détail — corrigé en gardant le PNG jusque dans le PDF
// final (voir `buildGuestBadgesPdf`).
//
// 5 équivaut à 360 DPI (5 x 72, le gabarit étant en points), au-dessus
// du seuil standard de 300 DPI pour une impression nette. Tenable ici
// (contrairement à un essai précédent à cette échelle sur les 10
// badges d'un coup, qui avait fait grimper le PDF à ~31 Mo / ~20s de
// génération — assez pour un "Failed to fetch" côté navigateur sur
// l'instance d'hébergement) parce que `buildGuestBadgesPdf` ne génère
// plus qu'UN SEUL genre à la fois (5 pages, voir le bouton dédié par
// genre côté admin) : ~15 Mo / ~10s, dans une plage sûre.
const BADGE_RASTER_SCALE = 5;

// Même format que les liens de mise à jour de fiche membre
// (memberCardSvg.service.js#buildQrDataUri) — reconnu par le même
// décodeur de QR côté scanner (extractQrParam), seule la FORME du
// code ("INV-...") le distingue d'un vrai matricule avant recherche
// en base (voir presence.service.js).
const buildBadgeCode = (genderCode, index) =>
  `INV-${genderCode}-${String(index).padStart(2, "0")}`;

const buildQrDataUri = async (code) => {
  const content = `${env.PUBLIC_SITE_URL}/inscription?matricule=${encodeURIComponent(code)}`;

  const buffer = await QRCode.toBuffer(content, {
    type: "png",
    width: 320,
    margin: 0,
    color: { dark: "#083b2a", light: "#ffffff" },
  });

  return toDataUri(buffer, "image/png");
};

const readTemplate = (fileName) =>
  rewriteFontFamilies(readFileSync(path.join(BADGES_DIR, fileName), "utf8"));

const buildBadgePng = async (genderDef, index) => {
  const source = readTemplate(genderDef.fileName);
  const document = parseSvgDocument(source);
  const code = buildBadgeCode(genderDef.code, index);

  const qrDataUri = await buildQrDataUri(code);

  setElementImageSource(
    requireElementById(document, "field-qr", genderDef.fileName),
    qrDataUri
  );

  reflowMultiTspanText(document, source);

  return rasterizeSvgToPng(serializeSvg(document), BADGE_RASTER_SCALE);
};

const pngToJpeg = async (png) => {
  const image = await loadImage(png);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(image, 0, 0);

  return canvas.toBuffer("image/jpeg", 0.85);
};

// Un badge à la fois (ex. pour un aperçu), plutôt que le PDF complet.
export const buildGuestBadgeJpeg = async (genderCode, index) => {
  const genderDef = GENDERS.find((item) => item.code === genderCode.toUpperCase());

  if (!genderDef || index < 1 || index > BADGES_PER_GENDER) {
    throw new Error("Badge invité inconnu.");
  }

  const png = await buildBadgePng(genderDef, index);

  return pngToJpeg(png);
};

// Les 5 badges d'UN SEUL genre, un par page, prêts à imprimer et
// découper — deux boutons séparés côté admin (un par genre) plutôt
// qu'un unique PDF de 10 pages : voir BADGE_RASTER_SCALE ci-dessus
// pour la raison (poids/temps de génération).
//
// PNG directement dans le PDF, jamais reconverti en JPEG (même
// principe que memberCardSvg.service.js#buildMemberCardPdf) : ces
// badges sont du texte/aplats de couleur à bords nets, exactement le
// type de contenu que la compression JPEG dégrade le plus visiblement
// (flou/artefacts en bordure de lettre) — sans bénéfice de poids
// notable ici vu qu'aucune photo n'entre dans un badge invité.
export const buildGuestBadgesPdf = async (genderCode) => {
  const genderDef = GENDERS.find((item) => item.code === genderCode?.toUpperCase());

  if (!genderDef) {
    throw ApiError.badRequest("Genre de badge invité inconnu (attendu : homme ou femme).");
  }

  const pages = [];

  for (let index = 1; index <= BADGES_PER_GENDER; index += 1) {
    const png = await buildBadgePng(genderDef, index);
    const image = await loadImage(png);

    pages.push({
      png,
      width: image.width / BADGE_RASTER_SCALE,
      height: image.height / BADGE_RASTER_SCALE,
    });
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, autoFirstPage: false });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    for (const page of pages) {
      doc.addPage({ size: [page.width, page.height], margin: 0 });
      doc.image(page.png, 0, 0, { width: page.width, height: page.height });
    }

    doc.end();
  });
};
