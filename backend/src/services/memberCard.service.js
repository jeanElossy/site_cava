import { fileURLToPath } from "node:url";
import path from "node:path";

import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import QRCode from "qrcode";
import PDFDocument from "pdfkit";

import Member from "../models/Member.js";
import Church from "../models/Church.js";
import { ApiError } from "../utils/ApiError.js";
import { formatRegistrationNumber } from "./registrationNumber.service.js";

const GREEN = "#0d5b3e";
const GREEN_DEEP = "#083b2a";
const GREEN_TINT = "#e7f1ec";
const GOLD = "#f4c41d";
const INK = "#1f2a25";
const INK_SOFT = "#5a6862";
const BORDER = "#e3eae6";

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

// Format carte de crédit standard (85,60 × 53,98 mm), en points
// (1 mm ≈ 2,83465 pt) — reconnaissable, imprimable tel quel.
const CARD_WIDTH = 243;
const CARD_HEIGHT = 153;
const BAND_HEIGHT = 50;
const CORNER_RADIUS = 12;

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

  // Silhouette à coins arrondis : tout ce qui suit (hors bordure
  // finale) est peint à l'intérieur de cette forme.
  ctx.save();
  roundedRectPath(ctx, 0, 0, CARD_WIDTH, CARD_HEIGHT, CORNER_RADIUS);
  ctx.clip();

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Bandeau d'en-tête en dégradé, plus riche qu'un aplat uni.
  const headerGradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, 0);
  headerGradient.addColorStop(0, GREEN);
  headerGradient.addColorStop(1, GREEN_DEEP);
  ctx.fillStyle = headerGradient;
  ctx.fillRect(0, 0, CARD_WIDTH, BAND_HEIGHT);

  // Liseré or : signature de la marque CAVA sur tout support imprimé.
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, BAND_HEIGHT, CARD_WIDTH, 3);

  const logoImage = await loadImage(LOGO_PATH);
  const logoHeight = 22;
  const logoWidth = (logoImage.width / logoImage.height) * logoHeight;

  ctx.drawImage(logoImage, 12, 9, logoWidth, logoHeight);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 8.5px ${CARD_FONT_BOLD}`;
  ctx.fillText("CENTRE APOSTOLIQUE", 42, 17, CARD_WIDTH - 52);
  ctx.fillText("VIE ET ABONDANCE", 42, 27, CARD_WIDTH - 52);

  ctx.fillStyle = GOLD;
  ctx.font = `bold 6.5px ${CARD_FONT_BOLD}`;
  ctx.fillText("CARTE DE MEMBRE", 42, 38, CARD_WIDTH - 52);

  // Pastille à initiales, à cheval sur la couture entre l'en-tête et
  // le corps — codes visuels d'un badge d'identité plutôt qu'un
  // simple bloc de texte.
  const avatarCx = 34;
  const avatarCy = BAND_HEIGHT + 3;
  const avatarR = 21;

  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarR + 2, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarR, 0, Math.PI * 2);
  ctx.fillStyle = GREEN_TINT;
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = GOLD;
  ctx.stroke();

  ctx.fillStyle = GREEN_DEEP;
  ctx.font = `bold 15px ${CARD_FONT_BOLD}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    initialsOf(member.firstName, member.lastName),
    avatarCx,
    avatarCy + 1
  );

  // Code QR en bas à droite, contenant les mêmes informations que
  // celles déjà imprimées en clair sur la carte (rien de plus
  // sensible) : nom, matricule, église, bergerie, année d'arrivée.
  const qrSize = 42;
  const qrX = CARD_WIDTH - qrSize - 10;
  const qrY = BAND_HEIGHT + 12;

  const qrContent = [
    "CAVA - Carte de membre",
    fullName,
    `Matricule : ${matricule}`,
    `Église : ${churchName}`,
    `Bergerie : ${flockName}`,
    joinedYear ? `Membre depuis ${joinedYear}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const qrBuffer = await QRCode.toBuffer(qrContent, {
    type: "png",
    width: qrSize * SCALE,
    margin: 0,
    color: { dark: GREEN_DEEP, light: "#ffffff" },
  });
  const qrImage = await loadImage(qrBuffer);

  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK_SOFT;
  ctx.font = `bold 5.5px ${CARD_FONT_BOLD}`;
  ctx.fillText("VÉRIFICATION", qrX + qrSize / 2, qrY + qrSize + 8);

  // Colonne de contenu : entre la pastille et le code QR.
  const contentX = 64;
  const contentWidth = qrX - contentX - 8;

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = INK;
  ctx.font = `bold 12px ${CARD_FONT_BOLD}`;
  ctx.fillText(fullName, contentX, BAND_HEIGHT + 21, contentWidth);

  // Matricule sous forme de « puce » plutôt qu'un simple texte : le
  // repère le plus important de la carte doit se voir en premier.
  ctx.font = `bold 11px ${CARD_FONT_BOLD}`;

  const chipTextWidth = ctx.measureText(matricule).width;
  const chipWidth = Math.min(chipTextWidth + 16, contentWidth);
  const chipY = BAND_HEIGHT + 27;

  roundedRectPath(ctx, contentX, chipY, chipWidth, 16, 8);
  ctx.fillStyle = GREEN_TINT;
  ctx.fill();

  ctx.fillStyle = GREEN_DEEP;
  ctx.textAlign = "center";
  ctx.fillText(matricule, contentX + chipWidth / 2, chipY + 11.5, chipWidth);
  ctx.textAlign = "left";

  // Lignes d'information, chacune repérée par une puce or plutôt
  // qu'un simple retour à la ligne — plus lisible en un coup d'œil
  // sur un aussi petit format.
  const rows = [
    churchName,
    flockName,
    joinedYear ? `Membre depuis ${joinedYear}` : "Membre",
  ];

  let rowY = BAND_HEIGHT + 58;

  ctx.font = `7.8px ${CARD_FONT}`;

  for (const row of rows) {
    ctx.beginPath();
    ctx.arc(contentX + 2, rowY - 2.8, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = GOLD;
    ctx.fill();

    ctx.fillStyle = INK_SOFT;
    ctx.fillText(row, contentX + 9, rowY, contentWidth - 9);

    rowY += 12;
  }

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
