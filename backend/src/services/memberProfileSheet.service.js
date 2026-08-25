import { fileURLToPath } from "node:url";
import path from "node:path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";

import Member from "../models/Member.js";
import Church from "../models/Church.js";
// Import de pur enregistrement, requis par `.populate("ministries", ...)`
// plus bas — voir memberCardSvg.service.js pour le même besoin.
import "../models/Ministry.js";
import { ApiError } from "../utils/ApiError.js";
import { isTrustedMemberPhotoUrl } from "../utils/cloudinaryUrl.js";
import { env } from "../config/env.js";
import { formatRegistrationNumber } from "./registrationNumber.service.js";

// Génération de la « Fiche Membre » : un dossier individuel imprimable
// reprenant l'ensemble des informations d'un membre, à l'usage interne
// de l'administration (jamais exposé publiquement — voir la section
// Notes internes plus bas). Calque visuel de receipt.service.js /
// socialReceipt.service.js (mêmes teintes GREEN/GOLD/INK/SOFT), mais
// construit entièrement via PDFKit plutôt qu'un gabarit SVG : ce
// document n'a pas d'équivalent Illustrator, contrairement à la carte
// de membre (voir memberCardSvg.service.js).

const GREEN = "#0d5b3e";
const GREEN_DARK = "#083b2a";
const GOLD = "#c9a227";
const INK = "#1f2a25";
const SOFT = "#6b746f";
const LINE = "#e2e9e5";
const CREAM = "#faf3da";

const ASSETS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../assets"
);
const LOGO_PATH = path.join(ASSETS_DIR, "logo-cava.png");

const FONTS_DIR = path.join(ASSETS_DIR, "fonts");

const registerFonts = (doc) => {
  doc.registerFont("Poppins", path.join(FONTS_DIR, "Poppins-Regular.ttf"));
  doc.registerFont("Poppins-Bold", path.join(FONTS_DIR, "Poppins-Bold.ttf"));
  doc.registerFont("Poppins-Italic", path.join(FONTS_DIR, "Poppins-Italic.ttf"));
};

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const formatDateOnly = (value) => {
  const date = value ? new Date(value) : null;

  if (!date || Number.isNaN(date.getTime())) return "—";

  return `${String(date.getDate()).padStart(2, "0")}/${String(
    date.getMonth() + 1
  ).padStart(2, "0")}/${date.getFullYear()}`;
};

const age = (dateOfBirth) => {
  if (!dateOfBirth) return "—";

  const birth = new Date(dateOfBirth);

  if (Number.isNaN(birth.getTime())) return "—";

  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    years -= 1;
  }

  return `${years} ans`;
};


// Libellés affichés — DOIT rester synchronisé avec MEMBER_ROLES dans
// src/pages/admin/CommunityAdmin.jsx, même contrat que
// memberCardSvg.service.js#ROLE_LABELS.
const ROLE_LABELS = {
  membre: "Membre",
  serviteur: "Serviteur",
  responsable: "Responsable",
  pasteur: "Pasteur Principal",
  chantre: "Chantre",
  dirigeant: "Dirigeant",
  instrumentaliste: "Instrumentaliste",
  evangeliste: "Évangéliste",
  intercesseur: "Intercesseur",
  intercesseurse: "Intercesseurse",
  organisateur: "Organisateur",
  organisatrice: "Organisatrice",
  monitrice: "Monitrice",
  "responsable de bergerie": "Responsable de bergerie",
  dirigeante: "Dirigeante",
  "responsable chantre": "Responsable Chantre",
  communication: "Communication",
  "responsable communication": "Responsable Communication",
  soa: "SOA",
  cana: "CANA",
  coordinateur_bergeries: "Coordonnateur des bergeries",
};

const GENDER_LABELS = { homme: "Homme", femme: "Femme" };
const MARITAL_LABELS = {
  celibataire: "Célibataire",
  marie: "Marié(e)",
  veuf: "Veuf(ve)",
  divorce: "Divorcé(e)",
};

const orDash = (value) => {
  if (value === null || value === undefined) return "—";

  const text = String(value).trim();

  return text ? text : "—";
};

const yesNo = (value, year) => {
  if (!value) return "Non";

  return year ? `Oui (${year})` : "Oui";
};

// Voir le commentaire sur son unique appelant, dans drawIdentityBlock,
// pour la raison de son existence (PDFKit ne fetch pas les URL).
const fetchTrustedPhotoBuffer = async (url) => {
  if (!url || !isTrustedMemberPhotoUrl(url)) return null;

  try {
    const response = await fetch(url);

    if (!response.ok) return null;

    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
};

// Même lien que le QR de la carte de membre (voir
// memberCardSvg.service.js#buildQrDataUri) : scanner l'un ou l'autre
// mène à la même page de mise à jour de fiche par matricule — un seul
// format de lien à maintenir.
const buildQrPngBuffer = async (member) => {
  if (!member.registrationNumber) return null;

  const qrContent = `${env.PUBLIC_SITE_URL}/inscription?matricule=${encodeURIComponent(
    member.registrationNumber
  )}`;

  return QRCode.toBuffer(qrContent, {
    type: "png",
    width: 200,
    margin: 0,
    color: { dark: "#083b2a", light: "#ffffff" },
  });
};

const drawHeader = (doc, member, church) => {
  const { width } = doc.page;
  const left = 32;
  const right = width - 32;

  // ---- Bloc identité CAVA (gauche) --------------------------------
  doc.image(LOGO_PATH, left, 26, { width: 56, height: 56 });

  doc
    .fillColor(GREEN_DARK)
    .font("Poppins-Bold")
    .fontSize(21)
    .text("ÇAVA", left + 68, 28, { characterSpacing: 0.5 });

  doc
    .fillColor(INK)
    .font("Poppins-Bold")
    .fontSize(8.5)
    .text("CENTRE APOSTOLIQUE", left + 68, 53, { characterSpacing: 0.4 })
    .text("VIE ET ABONDANCE", left + 68, 64, { characterSpacing: 0.4 });

  doc
    .fillColor(SOFT)
    .font("Poppins-Italic")
    .fontSize(7.5)
    .text("Une église, une famille, une destinée.", left + 68, 78);

  // ---- Bandeau « FICHE MEMBRE » (droite, parallélogramme) ---------
  const bannerRight = right;
  const bannerLeft = left + 300;
  const bannerTop = 22;
  const bannerBottom = 96;
  const skew = 16;

  doc
    .moveTo(bannerLeft + skew, bannerTop)
    .lineTo(bannerRight, bannerTop)
    .lineTo(bannerRight, bannerBottom)
    .lineTo(bannerLeft, bannerBottom)
    .closePath()
    .fill(GREEN);

  // Accent doré, coin supérieur droit.
  doc
    .moveTo(bannerRight - 26, bannerTop)
    .lineTo(bannerRight, bannerTop)
    .lineTo(bannerRight, bannerTop + 26)
    .closePath()
    .fill(GOLD);

  doc
    .fillColor("#ffffff")
    .font("Poppins-Bold")
    .fontSize(19)
    .text("FICHE MEMBRE", bannerLeft + skew, bannerTop + 16, {
      width: bannerRight - bannerLeft - skew - 10,
      align: "center",
      characterSpacing: 0.6,
    });

  doc
    .fillColor(GOLD)
    .font("Poppins-Bold")
    .fontSize(9)
    .text("DOSSIER INDIVIDUEL", bannerLeft + skew, bannerTop + 44, {
      width: bannerRight - bannerLeft - skew - 10,
      align: "center",
      characterSpacing: 1.4,
    });

  doc.moveTo(left, 108).lineTo(right, 108).strokeColor(GOLD).lineWidth(1.4).stroke();

  // ---- Verset ------------------------------------------------------
  const verse = church?.verse ??
    "Car nous sommes son ouvrage, ayant été créés en Jésus-Christ pour de bonnes œuvres, que Dieu a préparées d’avance afin que nous y marchions.";
  const reference = church?.verseReference ?? "ÉPHÉSIENS 2:10";

  doc
    .fillColor(GREEN_DARK)
    .font("Poppins-Italic")
    .fontSize(9.5)
    .text(`“ ${verse} ”`, left + 30, 118, {
      width: right - left - 60,
      align: "center",
      lineGap: 2,
    });

  doc
    .fillColor(INK)
    .font("Poppins-Bold")
    .fontSize(8.5)
    .text(reference, left, doc.y + 4, {
      width: right - left,
      align: "center",
      characterSpacing: 1,
    });

  doc.moveTo(left, doc.y + 10).lineTo(right, doc.y + 10).strokeColor(LINE).lineWidth(1).stroke();

  return doc.y + 18;
};

const drawIdentityBlock = async (doc, member, top, churchName) => {
  const left = 32;
  const photoW = 150;
  const photoH = 148;

  // ---- Photo --------------------------------------------------------
  doc
    .roundedRect(left, top, photoW, photoH, 8)
    .lineWidth(3)
    .strokeColor(GREEN)
    .stroke();

  // `doc.image()` de PDFKit ne sait lire qu'un Buffer ou un chemin de
  // fichier LOCAL — jamais une URL distante (contrairement à
  // `loadImage()` de @napi-rs/canvas, utilisé par
  // memberCardSvg.service.js). Il faut donc récupérer la photo
  // nous-mêmes, avec la même vérification de confiance (anti-SSRF)
  // que la carte de membre : seule une URL Cloudinary de notre compte
  // est effectivement demandée.
  const photoBuffer = await fetchTrustedPhotoBuffer(member.photo);

  if (photoBuffer) {
    try {
      doc.save();
      doc.roundedRect(left + 3, top + 3, photoW - 6, photoH - 6, 6).clip();

      // `cover`, JAMAIS `width` + `height` ensemble : donner les deux à
      // PDFKit étire l'image pour remplir exactement le cadre sans
      // respecter ses proportions — une photo portrait s'y écrasait,
      // une photo paysage s'y allongeait. C'était la déformation
      // constatée sur les fiches imprimées.
      //
      // `cover` remplit le cadre en RECADRANT, et `valign: "top"`
      // ancre ce recadrage vers le haut, exactement comme la carte de
      // membre (memberCardSvg.service.js) : sans détection de visage,
      // un ancrage centré coupe régulièrement le sommet de la tête.
      doc.image(photoBuffer, left + 3, top + 3, {
        cover: [photoW - 6, photoH - 6],
        align: "center",
        valign: "top",
      });

      doc.restore();
    } catch {
      // Image récupérée mais illisible (format inattendu, fichier
      // corrompu) : le cadre vide suffit, pas de raison de faire
      // échouer toute la fiche pour ça.
    }
  }

  // ---- QR de vérification, en médaillon sur le coin de la photo -----
  // Même lien que la carte de membre — pas un code-barres décoratif :
  // un vrai raccourci vers la fiche d'inscription de ce membre.
  const qrSize = 40;
  const qrX = left + photoW - qrSize - 6;
  const qrY = top + photoH - qrSize - 6;

  const qrBuffer = await buildQrPngBuffer(member);

  if (qrBuffer) {
    doc.roundedRect(qrX - 3, qrY - 3, qrSize + 6, qrSize + 6, 5).fill("#ffffff");
    doc
      .roundedRect(qrX - 3, qrY - 3, qrSize + 6, qrSize + 6, 5)
      .lineWidth(1.5)
      .strokeColor(GREEN)
      .stroke();
    doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
  }

  // ---- Bandeau matricule --------------------------------------------
  const matricule = formatRegistrationNumber(member.registrationNumber) || "—";
  const matriculeTop = top + photoH + 5;
  const matriculeH = 40;

  doc.roundedRect(left, matriculeTop, photoW, matriculeH, 6).fill(GREEN_DARK);

  doc
    .fillColor(GOLD)
    .font("Poppins-Bold")
    .fontSize(7)
    .text("MATRICULE MEMBRE", left, matriculeTop + 8, {
      width: photoW,
      align: "center",
      characterSpacing: 1,
    });

  doc
    .fillColor("#ffffff")
    .font("Poppins-Bold")
    .fontSize(15)
    .text(matricule, left, matriculeTop + 19, {
      width: photoW,
      align: "center",
      characterSpacing: 1.2,
    });

  doc
    .fillColor(SOFT)
    .font("Poppins")
    .fontSize(7)
    .text(`Date d’inscription : ${formatDateOnly(member.createdAt)}`, left, matriculeTop + matriculeH + 8, {
      width: photoW,
      align: "center",
    });

  // ---- Nom + statut ---------------------------------------------------
  const infoLeft = left + photoW + 20;
  const infoRight = doc.page.width - 32;
  const infoWidth = infoRight - infoLeft;

  doc
    .fillColor(INK)
    .font("Poppins-Bold")
    .fontSize(19)
    .text(`${member.lastName ?? ""} ${member.firstName ?? ""}`.trim().toUpperCase(), infoLeft, top, {
      width: infoWidth - 90,
    });

  const pillActive = member.status !== "inactif";

  doc
    .roundedRect(infoRight - 78, top, 78, 40, 8)
    .fill(pillActive ? GREEN : "#8a8f8c");

  doc
    .fillColor("#ffffff")
    .font("Poppins-Bold")
    .fontSize(6.5)
    .text("STATUT", infoRight - 78, top + 8, { width: 78, align: "center", characterSpacing: 1 });

  doc
    .font("Poppins-Bold")
    .fontSize(10.5)
    .text(pillActive ? "ACTIF" : "INACTIF", infoRight - 78, top + 20, {
      width: 78,
      align: "center",
      characterSpacing: 0.6,
    });

  // ---- Grille identité (2 colonnes) ----------------------------------
  const gridTop = top + 44;
  const colWidth = infoWidth / 2 - 8;

  const leftRows = [
    ["E-MAIL", orDash(member.email)],
    ["TÉLÉPHONE", orDash(member.phone)],
    ["WHATSAPP", orDash(member.whatsapp)],
  ];

  const rightRows = [
    ["ÉGLISE", orDash(churchName)],
    ["QUARTIER / GROUPE DE MAISON", orDash(member.area)],
    ["RÔLE", ROLE_LABELS[member.role] ?? "—"],
    ["ANNÉE D’ARRIVÉE", member.joinedAt ? String(new Date(member.joinedAt).getFullYear()) : "—"],
  ];

  const drawGridCell = (label, value, x, y, w) => {
    doc
      .fillColor(GOLD)
      .font("Poppins-Bold")
      .fontSize(6.5)
      .text(label, x, y, { width: w, characterSpacing: 0.6 });

    doc
      .fillColor(INK)
      .font("Poppins")
      .fontSize(9.5)
      .text(value, x, y + 10, { width: w, height: 12, ellipsis: true });
  };

  let ly = gridTop;
  let ry = gridTop;

  for (const [label, value] of leftRows) {
    drawGridCell(label, value, infoLeft, ly, colWidth);
    ly += 27;
  }

  for (const [label, value] of rightRows) {
    drawGridCell(label, value, infoLeft + colWidth + 16, ry, colWidth);
    ry += 27;
  }

  return Math.max(matriculeTop + matriculeH + 20, ly, ry) + 4;
};

// ------------------------------------------------------------------
// Boîtes d'informations génériques (bas de page).
// ------------------------------------------------------------------
const ROW_H = 14.5;
const BOX_HEADER_H = 20;
const BOX_PAD_TOP = 7;
const BOX_PAD_BOTTOM = 7;
const BOX_GAP = 10;

const boxHeight = (rows, extra = 0) =>
  BOX_HEADER_H + BOX_PAD_TOP + rows.length * ROW_H + BOX_PAD_BOTTOM + extra;

const drawBox = (doc, { x, y, width, title, rows, extra }) => {
  const height = boxHeight(rows, extra?.height ?? 0);

  doc
    .roundedRect(x, y, width, height, 8)
    .lineWidth(1)
    .strokeColor(LINE)
    .stroke();

  doc.roundedRect(x, y, width, BOX_HEADER_H, 8).fill("#f4f8f6");
  doc.rect(x, y + BOX_HEADER_H - 8, width, 8).fill("#f4f8f6");

  doc.rect(x, y, 4, BOX_HEADER_H).fill(GREEN);

  doc
    .fillColor(GREEN_DARK)
    .font("Poppins-Bold")
    .fontSize(9)
    .text(title.toUpperCase(), x + 16, y + 7, { width: width - 28, characterSpacing: 0.4 });

  let rowY = y + BOX_HEADER_H + BOX_PAD_TOP;

  for (const [label, value] of rows) {
    doc.font("Poppins").fontSize(8.3);

    const labelWidth = Math.min(doc.widthOfString(label) + 4, width * 0.55);
    const valueX = x + 14 + labelWidth;
    const valueWidth = width - 28 - labelWidth;

    doc.fillColor(SOFT).text(label, x + 14, rowY, { width: labelWidth, height: 11, ellipsis: true });

    doc
      .fillColor(INK)
      .font("Poppins-Bold")
      .fontSize(8.8)
      .text(String(value), valueX, rowY, {
        width: valueWidth,
        align: "right",
        height: 11,
        ellipsis: true,
      });

    rowY += ROW_H;
  }

  if (extra?.draw) {
    extra.draw(doc, x, rowY, width);
  }

  return y + height;
};

const drawTags = (doc, tags, x, y, width) => {
  if (!tags || tags.length === 0) {
    doc
      .fillColor(SOFT)
      .font("Poppins")
      .fontSize(8.3)
      .text("Aucune compétence renseignée.", x + 14, y, { width: width - 28 });

    return y + 20;
  }

  let cursorX = x + 14;
  let cursorY = y;
  const maxX = x + width - 14;

  doc.font("Poppins-Bold").fontSize(8);

  for (const tag of tags) {
    const tagWidth = doc.widthOfString(tag) + 16;

    if (cursorX + tagWidth > maxX) {
      cursorX = x + 14;
      cursorY += 20;
    }

    doc.roundedRect(cursorX, cursorY, tagWidth, 16, 8).fill("#eef2ea");
    doc.fillColor(GREEN_DARK).text(tag, cursorX + 8, cursorY + 4);

    cursorX += tagWidth + 6;
  }

  return cursorY + 24;
};

const drawNotesBox = (doc, { x, y, width, notes }) => {
  const height = 88;

  doc.roundedRect(x, y, width, height, 8).fill(CREAM);
  doc.roundedRect(x, y, width, height, 8).lineWidth(1).strokeColor("#e6d9a8").stroke();

  doc.rect(x, y, 4, height).fill(GOLD);

  doc
    .fillColor(GREEN_DARK)
    .font("Poppins-Bold")
    .fontSize(9)
    .text("NOTES INTERNES", x + 16, y + 10, { characterSpacing: 0.4 });

  doc
    .fillColor(SOFT)
    .font("Poppins-Italic")
    .fontSize(7)
    .text("Visible uniquement dans cette administration, jamais sur le site public.", x + 16, y + 24, {
      width: width - 32,
      height: 18,
      ellipsis: true,
    });

  doc
    .fillColor(INK)
    .font("Poppins")
    .fontSize(8.5)
    .text(notes?.trim() ? notes.trim() : "Aucune note interne n’a été ajoutée pour ce membre.", x + 16, y + 44, {
      width: width - 32,
      height: height - 54,
      ellipsis: true,
    });

  return y + height;
};

const drawFooter = (doc) => {
  const { width, height } = doc.page;
  const barTop = height - 42;

  doc.rect(0, barTop, width, 42).fill(GREEN_DARK);

  doc
    .fillColor("#ffffff")
    .font("Poppins-Bold")
    .fontSize(9)
    .text("CAVA — Centre Apostolique Vie et Abondance", 32, barTop + 9);

  doc
    .fillColor("#c9d6cf")
    .font("Poppins-Italic")
    .fontSize(7.5)
    .text("Une église, une famille, une destinée.", 32, barTop + 22);

  const badgeW = 150;
  const badgeX = width - 32 - badgeW;

  doc.roundedRect(badgeX, barTop + 6, badgeW, 30, 6).fill(GOLD);

  doc
    .fillColor(GREEN_DARK)
    .font("Poppins-Bold")
    .fontSize(6.5)
    .text("FICHE ÉDITÉE LE", badgeX, barTop + 11, { width: badgeW, align: "center", characterSpacing: 0.6 });

  doc
    .font("Poppins-Bold")
    .fontSize(10.5)
    .text(formatDateOnly(new Date()), badgeX, barTop + 20, { width: badgeW, align: "center" });
};

export const buildMemberProfileSheetPdf = async (memberId) => {
  const member = await Member.findById(memberId)
    .select("+notes")
    .populate("ministries", "name")
    .lean();

  if (!member) {
    throw ApiError.notFound("Membre introuvable.");
  }

  const church = member.church
    ? await Church.findOne({ number: member.church }).select("name").lean()
    : null;
  const churchName = church?.name ?? null;

  const doc = new PDFDocument({ size: "A4", margin: 0 });

  registerFonts(doc);

  const chunks = [];

  doc.on("data", (chunk) => chunks.push(chunk));

  const done = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const contentTop = drawHeader(doc, member, null);
  const gridTop = await drawIdentityBlock(doc, member, contentTop, churchName);

  const left = 32;
  const right = doc.page.width - 32;
  const colGap = 20;
  const colWidth = (right - left - colGap) / 2;
  const rightColX = left + colWidth + colGap;

  const ministryNames = (member.ministries ?? []).map((m) => m?.name).filter(Boolean);

  let leftY = gridTop;
  let rightY = gridTop;

  leftY = drawBox(doc, {
    x: left,
    y: leftY,
    width: colWidth,
    title: "Informations personnelles",
    rows: [
      ["Date de naissance", formatDateOnly(member.dateOfBirth)],
      ["Âge", age(member.dateOfBirth)],
      ["Genre", GENDER_LABELS[member.gender] ?? "—"],
      ["Situation matrimoniale", MARITAL_LABELS[member.maritalStatus] ?? "—"],
      ["Nombre d’enfants", member.childrenCount ?? "—"],
      ["Année de conversion", member.conversionYear ?? "—"],
      ["Baptisé(e) d’eau", yesNo(member.baptism?.water, member.baptism?.waterYear)],
      ["Baptisé(e) du Saint-Esprit", yesNo(member.baptism?.holySpirit)],
    ],
  }) + BOX_GAP;

  rightY = drawBox(doc, {
    x: rightColX,
    y: rightY,
    width: colWidth,
    title: "Parcours spirituel",
    rows: [
      ["Église précédente", orDash(member.previousChurch)],
      ["Profession", orDash(member.profession)],
      ["Disponibilités", orDash(member.availability)],
    ],
    extra: {
      height: 22,
      draw: (d, x, y, w) => drawTags(d, member.skills, x, y, w),
    },
  }) + BOX_GAP;

  leftY = drawBox(doc, {
    x: left,
    y: leftY,
    width: colWidth,
    title: "Informations administratives",
    rows: [
      ["Statut", member.status === "inactif" ? "Inactif" : "Actif"],
      ["Matricule", formatRegistrationNumber(member.registrationNumber) || "—"],
      ["Date d’inscription", formatDateOnly(member.createdAt)],
      ["Église", orDash(churchName)],
      ["Quartier / groupe de maison", orDash(member.area)],
      ["Rôle", ROLE_LABELS[member.role] ?? "—"],
    ],
  }) + BOX_GAP;

  rightY = drawBox(doc, {
    x: rightColX,
    y: rightY,
    width: colWidth,
    title: "Contact d’urgence",
    rows: [
      ["Nom", orDash(member.emergencyContact?.name)],
      ["Téléphone", orDash(member.emergencyContact?.phone)],
      ["Lien", orDash(member.emergencyContact?.relation)],
    ],
  }) + BOX_GAP;

  leftY = drawBox(doc, {
    x: left,
    y: leftY,
    width: colWidth,
    title: "Coordonnées complémentaires",
    rows: [
      ["Téléphone", orDash(member.phone)],
      ["WhatsApp", orDash(member.whatsapp)],
      ["E-mail", orDash(member.email)],
    ],
  }) + BOX_GAP;

  rightY = drawBox(doc, {
    x: rightColX,
    y: rightY,
    width: colWidth,
    title: "Services & implication",
    rows: [
      ["Département souhaité", orDash(member.desiredDepartment)],
      ["Ministère(s)", ministryNames.length > 0 ? ministryNames.join(", ") : "—"],
      ["Fonction / rôle", ROLE_LABELS[member.role] ?? "—"],
    ],
  }) + BOX_GAP;

  drawNotesBox(doc, {
    x: rightColX,
    y: rightY,
    width: colWidth,
    notes: member.notes,
  });

  drawFooter(doc);

  doc.end();

  return done;
};
