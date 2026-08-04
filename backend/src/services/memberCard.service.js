import { fileURLToPath } from "node:url";
import path from "node:path";

import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import QRCode from "qrcode";
import PDFDocument from "pdfkit";

import Member from "../models/Member.js";
import Church from "../models/Church.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import { isTrustedMemberPhotoUrl } from "../utils/cloudinaryUrl.js";
import { formatRegistrationNumber } from "./registrationNumber.service.js";

const GREEN = "#0d5b3e";
const GREEN_DEEP = "#083b2a";
const GREEN_TINT = "#e7f1ec";
const GOLD = "#f4c41d";
const GOLD_DEEP = "#c99a12";
const CREAM = "#faf8f3";
const INK = "#1f2a25";
const INK_SOFT = "#5a6862";
const BORDER = "#e5e0d2";

// Même logo PNG que le registre imprimable (memberExport.service.js) :
// pdfkit et @napi-rs/canvas lisent tous les deux PNG/JPEG, pas le
// .gif utilisé côté site public.
const LOGO_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../assets/logo-cava.png"
);

// @napi-rs/canvas s'appuie sur les polices disponibles sur la machine
// qui l'exécute. En local (Windows), la police système suffit et le
// rendu est correct — mais rien ne garantit qu'une police TrueType
// soit installée sur l'image Node standard de Render (Linux minimal) :
// si aucune ne l'est, le texte de la carte disparaîtrait purement et
// simplement (glyphes vides), alors même que les tests passent en
// local. On embarque donc Poppins — déjà la police du site (voir
// index.html), sous licence SIL Open Font License (texte complet dans
// assets/fonts/OFL.txt) qui autorise explicitement ce type
// d'intégration — et on l'enregistre nous-mêmes, plutôt que de
// dépendre de ce qui se trouve (ou non) sur le système hôte.
//
// Alias dédiés pour le gras plutôt que de compter sur la résolution de
// `font-weight: bold` par le moteur de rendu à partir d'une seule
// famille enregistrée : comportement identique quelle que soit la
// plateforme.
const FONTS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../assets/fonts"
);
const CARD_FONT = "CavaCardSans";
const CARD_FONT_BOLD = "CavaCardSansBold";

const fontsRegistered =
  Boolean(
    GlobalFonts.registerFromPath(
      path.join(FONTS_DIR, "Poppins-Regular.ttf"),
      CARD_FONT
    )
  ) &&
  Boolean(
    GlobalFonts.registerFromPath(
      path.join(FONTS_DIR, "Poppins-Bold.ttf"),
      CARD_FONT_BOLD
    )
  );

if (!fontsRegistered) {
  // Ne bloque pas la génération (le canvas retombera sur une police par
  // défaut, potentiellement absente elle aussi) mais doit rester
  // visible dans les journaux du serveur : un texte manquant sur une
  // carte imprimée est un défaut silencieux sinon.
  // eslint-disable-next-line no-console
  console.error(
    "[memberCard] Échec de l'enregistrement de la police Poppins embarquée : le texte des cartes de membre risque de ne pas s'afficher."
  );
}

// Format badge/certificat (proportions 3:2), plus grand qu'une carte
// de crédit ISO : nécessaire pour un contenu aussi riche (bandeau
// diagonal, photo/pastille, cinq lignes d'information, QR, pied de
// page) tout en restant lisible imprimé.
const CARD_WIDTH = 390;
const CARD_HEIGHT = 260;
const CORNER_RADIUS = 16;

// Colonne verte diagonale de gauche.
const PANEL_WIDTH = 108;
const PANEL_SLANT = 24;

const FOOTER_HEIGHT = 50;

// Résolution de rendu : la carte est dessinée UNE SEULE FOIS dans un
// canvas raster (à cette échelle, ~300 dpi pour ce format), utilisé
// tel quel pour le JPEG et intégré comme image plein cadre dans le
// PDF. Ça garantit un rendu strictement identique entre les deux
// formats, plutôt que deux implémentations séparées qui finiraient
// par diverger.
const SCALE = 4;

const toTitleCase = (value = "") =>
  value
    .toLowerCase()
    .replace(/(^|[\s-])\p{L}/gu, (match) => match.toUpperCase());

// Aucune fiche membre ne porte de photo aujourd'hui : une pastille à
// initiales, comme celle déjà utilisée dans l'en-tête de
// l'administration, plutôt qu'un cadre vide.
const initialsOf = (firstName, lastName) =>
  [firstName, lastName]
    .filter(Boolean)
    .map((part) => part.trim()[0]?.toUpperCase())
    .filter(Boolean)
    .join("") || "?";

const roundedRectPath = (ctx, x, y, width, height, radius) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
};

// Petits pictogrammes dessinés à la main (arcs/traits), plutôt qu'une
// dépendance supplémentaire pour importer une véritable bibliothèque
// d'icônes dans un contexte canvas côté serveur — largement suffisant
// à la taille où ils apparaissent sur la carte.
const drawPersonGlyph = (ctx, cx, cy, r, color) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.32, r * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.55, cy + r * 0.55);
  ctx.quadraticCurveTo(cx, cy - r * 0.05, cx + r * 0.55, cy + r * 0.55);
  ctx.lineTo(cx + r * 0.55, cy + r * 0.68);
  ctx.lineTo(cx - r * 0.55, cy + r * 0.68);
  ctx.closePath();
  ctx.fill();
};

const drawIdCardGlyph = (ctx, cx, cy, r, color) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 0.16;
  roundedRectPath(ctx, cx - r * 0.6, cy - r * 0.42, r * 1.2, r * 0.84, r * 0.14);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx - r * 0.28, cy - r * 0.03, r * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = r * 0.1;
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.02, cy - r * 0.03);
  ctx.lineTo(cx + r * 0.42, cy - r * 0.03);
  ctx.moveTo(cx - r * 0.42, cy + r * 0.24);
  ctx.lineTo(cx + r * 0.42, cy + r * 0.24);
  ctx.stroke();
};

const drawCalendarGlyph = (ctx, cx, cy, r, color) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 0.14;
  roundedRectPath(ctx, cx - r * 0.55, cy - r * 0.4, r * 1.1, r * 0.9, r * 0.12);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.55, cy - r * 0.1);
  ctx.lineTo(cx + r * 0.55, cy - r * 0.1);
  ctx.stroke();
  ctx.lineWidth = r * 0.14;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.26, cy - r * 0.55);
  ctx.lineTo(cx - r * 0.26, cy - r * 0.25);
  ctx.moveTo(cx + r * 0.26, cy - r * 0.55);
  ctx.lineTo(cx + r * 0.26, cy - r * 0.25);
  ctx.stroke();
};

// Groupe/bergerie : trois barres horizontales (icône « liste de
// membres »), plus lisible à cette taille qu'un amas de cercles.
const drawGroupGlyph = (ctx, cx, cy, r, color) => {
  ctx.fillStyle = color;

  const widths = [0.9, 0.7, 0.5];

  widths.forEach((w, index) => {
    const y = cy - r * 0.42 + index * r * 0.42;

    roundedRectPath(ctx, cx - (r * w) / 2, y, r * w, r * 0.24, r * 0.12);
    ctx.fill();
  });
};

const drawPinGlyph = (ctx, cx, cy, r, color) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.15, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.3, cy + r * 0.05);
  ctx.lineTo(cx, cy + r * 0.65);
  ctx.lineTo(cx + r * 0.3, cy + r * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.15, r * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = CREAM;
  ctx.fill();
};

const drawShieldCheckGlyph = (ctx, cx, cy, r, color) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.6);
  ctx.lineTo(cx + r * 0.45, cy - r * 0.35);
  ctx.lineTo(cx + r * 0.45, cy + r * 0.1);
  ctx.quadraticCurveTo(cx + r * 0.45, cy + r * 0.5, cx, cy + r * 0.65);
  ctx.quadraticCurveTo(cx - r * 0.45, cy + r * 0.5, cx - r * 0.45, cy + r * 0.1);
  ctx.lineTo(cx - r * 0.45, cy - r * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = r * 0.16;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.2, cy);
  ctx.lineTo(cx - r * 0.02, cy + r * 0.22);
  ctx.lineTo(cx + r * 0.28, cy - r * 0.18);
  ctx.stroke();
};

// Réduit progressivement la taille de police jusqu'à ce que le texte
// tienne dans `maxWidth`, plutôt que de le laisser se comprimer
// horizontalement (l'effet par défaut de `fillText` avec un
// `maxWidth`, illisible dès qu'un nom ou celui de l'église dépasse ce
// qu'un champ aussi étroit peut accueillir).
const fillTextFit = (
  ctx,
  text,
  x,
  y,
  maxWidth,
  maxFontPx,
  fontFamily,
  minFontPx = 6.5
) => {
  let size = maxFontPx;

  ctx.font = `bold ${size}px ${fontFamily}`;

  while (size > minFontPx && ctx.measureText(text).width > maxWidth) {
    size -= 0.5;
    ctx.font = `bold ${size}px ${fontFamily}`;
  }

  ctx.fillText(text, x, y);
};

// Cercle vert + pictogramme blanc, comme les repères de chaque ligne
// d'information sur le modèle de référence.
const drawIconBadge = (ctx, cx, cy, radius, glyph) => {
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = GREEN;
  ctx.fill();
  glyph(ctx, cx, cy, radius * 0.82, "#ffffff");
};

const loadMemberForCard = async (memberId) => {
  const member = await Member.findById(memberId)
    .populate("flock", "name")
    .lean();

  if (!member) {
    throw ApiError.notFound("Membre introuvable.");
  }

  if (!member.registrationNumber) {
    throw ApiError.unprocessable(
      "Ce membre n'a pas encore de matricule : aucune carte ne peut être générée."
    );
  }

  // `church` n'est qu'un numéro sur la fiche membre (1-5) — le nom
  // réel vit dans la collection `Church`, à part.
  const church = member.church
    ? await Church.findOne({ number: member.church }).lean()
    : null;

  return { member, church };
};

const renderMemberCardCanvas = async (member, church) => {
  const canvas = createCanvas(CARD_WIDTH * SCALE, CARD_HEIGHT * SCALE);
  const ctx = canvas.getContext("2d");

  ctx.scale(SCALE, SCALE);

  const fullName = [
    toTitleCase(member.firstName ?? ""),
    member.lastName ? member.lastName.toUpperCase() : "",
  ]
    .filter(Boolean)
    .join(" ");

  const joinedYear = member.joinedAt
    ? new Date(member.joinedAt).getFullYear()
    : null;

  const churchName = church?.name ?? `Église ${member.church}`;
  const flockName = member.flock?.name ?? "Bergerie non renseignée";
  const matricule = formatRegistrationNumber(member.registrationNumber);
  const isActive = member.status !== "inactif";
  const statusLabel = isActive ? "MEMBRE ACTIF" : "MEMBRE INACTIF";

  // Silhouette à coins arrondis : tout ce qui suit (hors bordure
  // finale) est peint à l'intérieur de cette forme.
  ctx.save();
  roundedRectPath(ctx, 0, 0, CARD_WIDTH, CARD_HEIGHT, CORNER_RADIUS);
  ctx.clip();

  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Filigrane discret (une croix) dans la zone claire : présence
  // décorative très légère, jamais assez marquée pour gêner la
  // lecture du texte posé par-dessus.
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = GREEN;
  ctx.fillRect(CARD_WIDTH - 108, 26, 64, 16);
  ctx.fillRect(CARD_WIDTH - 84, 4, 16, 60);
  ctx.restore();

  // ---- Colonne verte diagonale (gauche) ----------------------------

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(PANEL_WIDTH + PANEL_SLANT, 0);
  ctx.lineTo(PANEL_WIDTH, 50);
  ctx.lineTo(PANEL_WIDTH, CARD_HEIGHT);
  ctx.lineTo(0, CARD_HEIGHT);
  ctx.closePath();

  const panelGradient = ctx.createLinearGradient(0, 0, PANEL_WIDTH, CARD_HEIGHT);
  panelGradient.addColorStop(0, GREEN);
  panelGradient.addColorStop(1, GREEN_DEEP);
  ctx.fillStyle = panelGradient;
  ctx.fill();

  // ---- Pied de page vert, pleine largeur ---------------------------

  ctx.fillStyle = GREEN_DEEP;
  ctx.fillRect(0, CARD_HEIGHT - FOOTER_HEIGHT, CARD_WIDTH, FOOTER_HEIGHT);

  ctx.fillStyle = GOLD;
  ctx.fillRect(0, CARD_HEIGHT - FOOTER_HEIGHT - 2.5, CARD_WIDTH, 2.5);

  // ---- Logo + nom de l'église, en haut du bandeau vert -------------

  const logoImage = await loadImage(LOGO_PATH);
  const logoHeight = 26;
  const logoWidth = (logoImage.width / logoImage.height) * logoHeight;

  ctx.drawImage(logoImage, 14, 14, logoWidth, logoHeight);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 15px ${CARD_FONT_BOLD}`;
  ctx.fillText("CAVA", 14, 54);

  ctx.font = `bold 6px ${CARD_FONT_BOLD}`;
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fillText("CENTRE APOSTOLIQUE", 14, 62, PANEL_WIDTH - 18);
  ctx.fillText("VIE ET ABONDANCE", 14, 69, PANEL_WIDTH - 18);

  // ---- Photo si le membre en a envoyé une, sinon pastille à
  // initiales (le cas le plus courant tant que peu de monde a
  // téléversé la sienne).

  const avatarCx = PANEL_WIDTH / 2;
  const avatarCy = 122;
  const avatarSize = 76;
  const avatarX = avatarCx - avatarSize / 2;
  const avatarY = avatarCy - avatarSize / 2;

  let photoImage = null;

  // Défense en profondeur : le schéma (Member.js) refuse déjà d'
  // enregistrer une URL qui ne provient pas de notre Cloudinary, mais
  // cette vérification est refaite ici, juste avant la seule ligne où
  // le SERVEUR récupère lui-même une URL fournie par un membre — le
  // point d'impact réel d'un éventuel SSRF (voir utils/cloudinaryUrl.js).
  if (member.photo && isTrustedMemberPhotoUrl(member.photo)) {
    try {
      photoImage = await loadImage(member.photo);
    } catch {
      // URL cassée ou hôte injoignable au moment du rendu : repli sur
      // les initiales plutôt que de faire échouer toute la carte.
      photoImage = null;
    }
  }

  if (photoImage) {
    ctx.save();
    roundedRectPath(ctx, avatarX, avatarY, avatarSize, avatarSize, 14);
    ctx.clip();

    // Recadrage centré au carré (« cover ») : la photo source n'a pas
    // forcément le même ratio que la pastille.
    const sourceSize = Math.min(photoImage.width, photoImage.height);
    const sourceX = (photoImage.width - sourceSize) / 2;
    const sourceY = (photoImage.height - sourceSize) / 2;

    ctx.drawImage(
      photoImage,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      avatarX,
      avatarY,
      avatarSize,
      avatarSize
    );
    ctx.restore();

    roundedRectPath(ctx, avatarX, avatarY, avatarSize, avatarSize, 14);
    ctx.lineWidth = 3;
    ctx.strokeStyle = GOLD;
    ctx.stroke();
  } else {
    roundedRectPath(ctx, avatarX, avatarY, avatarSize, avatarSize, 14);
    ctx.fillStyle = CREAM;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = GOLD;
    ctx.stroke();

    ctx.fillStyle = GREEN_DEEP;
    ctx.font = `bold 26px ${CARD_FONT_BOLD}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      initialsOf(member.firstName, member.lastName),
      avatarCx,
      avatarCy + 2
    );
  }

  // ---- Devise de l'église, sous la pastille -------------------------

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = GOLD;
  ctx.font = `italic 7px ${CARD_FONT}`;
  ctx.fillText("Nous sommes bâtis pour", avatarCx, 172, PANEL_WIDTH - 12);

  ctx.font = `bold 10px ${CARD_FONT_BOLD}`;
  ctx.fillText("Vivre et Abonder", avatarCx, 184, PANEL_WIDTH - 12);

  ctx.font = `7px ${CARD_FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText("Jean 10:10", avatarCx, 196, PANEL_WIDTH - 12);

  ctx.textAlign = "left";

  // ---- Ruban de statut, coin supérieur droit ------------------------

  const ribbonWidth = 74;
  const ribbonX = CARD_WIDTH - ribbonWidth;

  ctx.beginPath();
  ctx.moveTo(ribbonX, 0);
  ctx.lineTo(CARD_WIDTH, 0);
  ctx.lineTo(CARD_WIDTH, 46);
  ctx.lineTo(ribbonX + ribbonWidth / 2, 38);
  ctx.lineTo(ribbonX, 46);
  ctx.closePath();

  const ribbonGradient = ctx.createLinearGradient(ribbonX, 0, CARD_WIDTH, 46);
  ribbonGradient.addColorStop(0, GOLD_DEEP);
  ribbonGradient.addColorStop(1, GOLD);
  ctx.fillStyle = ribbonGradient;
  ctx.fill();

  drawPersonGlyph(ctx, ribbonX + ribbonWidth / 2, 16, 15, GREEN_DEEP);

  ctx.textAlign = "center";
  ctx.fillStyle = GREEN_DEEP;
  ctx.font = `bold 6px ${CARD_FONT_BOLD}`;
  ctx.fillText(statusLabel, ribbonX + ribbonWidth / 2, 32, ribbonWidth - 8);
  ctx.textAlign = "left";

  // ---- Colonne de contenu (à droite du bandeau vert) ----------------

  const contentX = PANEL_WIDTH + PANEL_SLANT + 14;
  const contentRight = CARD_WIDTH - 16;
  // Le titre ne doit jamais empiéter sous le ruban de statut, posé
  // par-dessus dans le coin supérieur droit.
  const headingWidth = ribbonX - contentX - 10;

  ctx.fillStyle = GREEN;
  fillTextFit(ctx, "CARTE DE MEMBRE", contentX, 42, headingWidth, 19, CARD_FONT_BOLD, 13);

  ctx.fillStyle = isActive ? GOLD_DEEP : INK_SOFT;
  fillTextFit(ctx, statusLabel, contentX, 56, headingWidth, 10, CARD_FONT_BOLD, 8);

  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(contentX, 66);
  ctx.lineTo(contentRight, 66);
  ctx.stroke();

  // ---- Code QR : ouvre le tunnel d'inscription public en mode « j'ai
  // déjà un matricule », matricule pré-rempli. Le nom de famille reste
  // à saisir par le membre lui-même avant que la recherche parte —
  // même protection anti-énumération que la saisie manuelle (voir
  // submission.service.js#lookup), le QR ne fait qu'éviter d'avoir à
  // retaper le matricule déjà imprimé juste à côté.
  const qrSize = 66;
  const qrX = contentRight - qrSize;
  const qrY = 84;

  const qrContent = `${env.PUBLIC_SITE_URL}/inscription?matricule=${encodeURIComponent(
    member.registrationNumber
  )}`;

  const qrBuffer = await QRCode.toBuffer(qrContent, {
    type: "png",
    width: qrSize * SCALE,
    margin: 0,
    color: { dark: GREEN_DEEP, light: "#ffffff" },
  });
  const qrImage = await loadImage(qrBuffer);

  roundedRectPath(ctx, qrX - 5, qrY - 5, qrSize + 10, qrSize + 10, 8);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = GREEN;
  ctx.stroke();

  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  const qrCenterX = qrX + qrSize / 2;

  drawShieldCheckGlyph(ctx, qrCenterX, qrY + qrSize + 12, 7, GREEN);

  ctx.textAlign = "center";
  ctx.fillStyle = INK_SOFT;
  ctx.font = `bold 6px ${CARD_FONT_BOLD}`;
  ctx.fillText("Scannez pour mettre à", qrCenterX, qrY + qrSize + 26, qrSize + 10);
  ctx.fillText("jour votre fiche", qrCenterX, qrY + qrSize + 34, qrSize + 10);
  ctx.textAlign = "left";

  // ---- Lignes d'information, chacune avec son pictogramme -----------

  const rows = [
    { icon: drawPersonGlyph, label: "NOM & PRÉNOMS", value: fullName },
    { icon: drawIdCardGlyph, label: "MATRICULE", value: matricule },
    {
      icon: drawCalendarGlyph,
      label: "MEMBRE DEPUIS",
      value: joinedYear ? String(joinedYear) : "—",
    },
    { icon: drawGroupGlyph, label: "BERGERIE", value: flockName },
    { icon: drawPinGlyph, label: "ÉGLISE", value: churchName },
  ];

  const rowIconX = contentX + 11;
  const rowTextX = contentX + 28;
  const rowTextWidth = qrX - 14 - rowTextX;
  let rowY = 92;

  for (const row of rows) {
    drawIconBadge(ctx, rowIconX, rowY, 11, row.icon);

    ctx.fillStyle = GREEN;
    ctx.font = `bold 6px ${CARD_FONT_BOLD}`;
    ctx.fillText(row.label, rowTextX, rowY - 3, rowTextWidth);

    ctx.fillStyle = INK;
    fillTextFit(ctx, row.value, rowTextX, rowY + 7, rowTextWidth, 10, CARD_FONT_BOLD);

    if (row !== rows[rows.length - 1]) {
      ctx.strokeStyle = BORDER;
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.moveTo(rowTextX, rowY + 13);
      ctx.lineTo(qrX - 14, rowY + 13);
      ctx.stroke();
    }

    rowY += 23;
  }

  // ---- Pied de page : verset, signature, localisation ----------------

  const footerTop = CARD_HEIGHT - FOOTER_HEIGHT;

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = `italic 7px ${CARD_FONT}`;
  ctx.fillText(
    "« Je suis venu afin qu'ils aient la vie,",
    16,
    footerTop + 19,
    216
  );
  ctx.fillText("et qu'ils l'aient en abondance. »", 16, footerTop + 28, 216);

  ctx.fillStyle = GOLD;
  ctx.font = `bold 7px ${CARD_FONT_BOLD}`;
  ctx.fillText("Jean 10:10", 16, footerTop + 39, 216);

  const signatureX = CARD_WIDTH / 2 - 8;

  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  ctx.moveTo(signatureX - 34, footerTop + 24);
  ctx.lineTo(signatureX + 34, footerTop + 24);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `bold 6px ${CARD_FONT_BOLD}`;
  ctx.fillText("CACHET & SIGNATURE", signatureX, footerTop + 34, 90);

  ctx.font = `bold 6px ${CARD_FONT_BOLD}`;
  ctx.fillStyle = GOLD;
  ctx.fillText("ABIDJAN, CÔTE D'IVOIRE", CARD_WIDTH - 74, footerTop + 22, 130);
  ctx.font = `7px ${CARD_FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText("Carte officielle CAVA", CARD_WIDTH - 74, footerTop + 32, 130);
  ctx.textAlign = "left";

  ctx.restore();

  // Contour fin, dessiné hors du clip pour rester net sur les bords —
  // repère visuel si la carte est imprimée sur papier blanc, où
  // l'arrondi seul ne se distinguerait pas de la feuille.
  roundedRectPath(
    ctx,
    0.75,
    0.75,
    CARD_WIDTH - 1.5,
    CARD_HEIGHT - 1.5,
    CORNER_RADIUS
  );
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = BORDER;
  ctx.stroke();

  return canvas;
};

export const buildMemberCardJpeg = async (memberId) => {
  const { member, church } = await loadMemberForCard(memberId);
  const canvas = await renderMemberCardCanvas(member, church);

  return canvas.toBuffer("image/jpeg", 0.92);
};

export const buildMemberCardPdf = async (memberId) => {
  const { member, church } = await loadMemberForCard(memberId);
  const canvas = await renderMemberCardCanvas(member, church);
  const pngBuffer = canvas.toBuffer("image/png");

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [CARD_WIDTH, CARD_HEIGHT],
      margin: 0,
    });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.image(pngBuffer, 0, 0, { width: CARD_WIDTH, height: CARD_HEIGHT });

    doc.end();
  });
};
