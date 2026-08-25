import PDFDocument from "pdfkit";
import QRCode from "qrcode";

import Settings from "../models/Settings.js";
import Church from "../models/Church.js";

import { env } from "../config/env.js";
import { toFrenchWords } from "../utils/frenchNumber.js";

// Génération du reçu de cotisation sociale.
//
// Calque de receipt.service.js (reçu de don), avec deux différences
// assumées :
//
//   - « REÇU DE COTISATION SOCIALE », pas « REÇU DE CONTRIBUTION » : ce
//     n'est ni un don ni un reçu fiscal, c'est le paiement d'une
//     cotisation obligatoire au fonds de solidarité.
//   - le QR pointe vers une route AUTHENTIFIÉE du dashboard
//     (/api/admin/social/contributions/:id/recu), contrairement au
//     reçu de don qui est public par référence. Il sert de rappel
//     visuel de traçabilité pour l'administration, pas de lien
//     cliquable par un tiers.

const GREEN = "#0d5b3e";
const GOLD = "#c9a227";
const INK = "#1f2a25";
const SOFT = "#6b746f";

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const STATUS_LABELS = {
  paye: "Payé",
  partiel: "Partiel",
  non_paye: "Non payé",
  exonere: "Exonéré",
  annule: "Annulé",
};

const formatDate = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return (
    `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}` +
    ` à ${String(date.getHours()).padStart(2, "0")}h${String(
      date.getMinutes()
    ).padStart(2, "0")}`
  );
};

const periodLabel = (month, year) => `${MONTHS[(month ?? 1) - 1] ?? "?"} ${year}`;

// ------------------------------------------------------------------
// TEXTE COMPATIBLE AVEC LES POLICES DE BASE DU PDF
// ------------------------------------------------------------------
// Reprise à l'identique de receipt.service.js#safe : les polices
// standard d'un PDF (Helvetica) utilisent l'encodage WinAnsi, qui ne
// couvre pas tout l'Unicode — un caractère absent ne provoque aucune
// erreur, il est remplacé ou supprimé en silence.
const safe = (value) =>
  String(value ?? "")
    // Espaces insécables (fine ou normale) : une espace ordinaire.
    .replace(/[   ]/g, " ")
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "OE")
    // Tirets longs et demi-longs.
    .replace(/[–—]/g, "-")
    // Apostrophes et guillemets courbes.
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...");

// Séparateur de milliers posé à la main, avec une espace ordinaire.
// `toLocaleString` produit une espace fine insécable, invisible à la
// lecture du code et illisible dans le PDF.
const money = (value) => {
  const n = Math.trunc(Number(value ?? 0));

  return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} F CFA`;
};

const churchIdentity = async () => {
  const settings = await Settings.findOne({ key: "site" }).lean();

  const pick = (value, fallback) =>
    typeof value === "string" && value.trim() ? value.trim() : fallback;

  return {
    name: pick(settings?.churchName, "Centre Apostolique Vie et Abondance"),
    address: pick(settings?.address, "Abidjan, Côte d'Ivoire"),
    phone: pick(settings?.phonePrimary, ""),
    email: pick(settings?.email, ""),
  };
};

// Nom réel de l'église, tel qu'il est administré dans la ressource
// `churches` — « Centre Apostolique Vie et Abondance (CAVA) » plutôt
// que « Église 1 ». Même source que la fiche membre PDF
// (memberProfileSheet.service.js) et que les écrans d'administration.
//
// Repli sur « Église N » seulement si le numéro n'a pas (ou plus) de
// fiche correspondante : mieux vaut un libellé générique qu'un tiret
// sur un reçu qui, lui, existe bel et bien.
const churchLabel = async (number) => {
  if (!number) return "—";

  const church = await Church.findOne({ number }).select("name").lean();

  return church?.name ?? `Église ${number}`;
};

const memberLine = (contribution) => {
  const member = contribution.member ?? {};
  const full = [member.firstName, member.lastName].filter(Boolean).join(" ");

  return full || "Non renseigné";
};

// Construit le PDF et le renvoie sous forme de Buffer — voir
// receipt.service.js#buildReceipt pour la justification de ce choix
// (répondre une erreur propre en cas d'échec en cours de génération).
export const buildContributionReceipt = async (contribution) => {
  const church = await churchIdentity();
  const memberChurchLabel = await churchLabel(contribution.church);

  const verifyUrl = `${env.PUBLIC_API_URL}/api/admin/social/contributions/${contribution._id}/recu`;

  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    width: 300,
    margin: 0,
    color: { dark: GREEN, light: "#ffffff" },
  });

  const qrBuffer = Buffer.from(qrDataUrl.split(",")[1], "base64");

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, bottom: 50, left: 55, right: 55 },
    info: {
      Title: `Reçu d'offrande sociale ${contribution.reference}`,
      Author: church.name,
      Subject: "Reçu d'offrande sociale",
    },
  });

  const writeText = doc.text.bind(doc);

  doc.text = (value, ...rest) => writeText(safe(value), ...rest);

  const chunks = [];

  doc.on("data", (chunk) => chunks.push(chunk));

  const done = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const { width } = doc.page;
  const left = doc.page.margins.left;
  const right = width - doc.page.margins.right;
  const inner = right - left;

  // ---- Bandeau d'en-tête ----------------------------------------
  doc.rect(0, 0, width, 130).fill(GREEN);

  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(19)
    .text(church.name, left, 38, { width: inner });

  doc
    .font("Helvetica")
    .fontSize(9.5)
    .fillColor("#d6e5de")
    .text(church.address, left, 66, { width: inner });

  const contact = [church.phone, church.email].filter(Boolean).join("  ·  ");

  if (contact) {
    doc.text(contact, left, 81, { width: inner });
  }

  // Filet doré, rappel de l'identité visuelle du site.
  doc.rect(0, 130, width, 4).fill(GOLD);

  // ---- Titre ------------------------------------------------------
  doc
    .fillColor(INK)
    .font("Helvetica-Bold")
    .fontSize(16)
    .text("REÇU D'OFFRANDE SOCIALE", left, 168, {
      width: inner,
      align: "center",
      characterSpacing: 1.2,
    });

  doc
    .font("Helvetica")
    .fontSize(9.5)
    .fillColor(SOFT)
    .text(`Référence ${contribution.reference}`, left, 192, {
      width: inner,
      align: "center",
    });

  // ---- Montant, mis en avant --------------------------------------
  const boxTop = 224;

  doc
    .roundedRect(left, boxTop, inner, 92, 10)
    .fillAndStroke("#f4f8f6", "#dbe6e0");

  doc
    .fillColor(SOFT)
    .font("Helvetica")
    .fontSize(8.5)
    .text("MONTANT VERSÉ", left, boxTop + 16, {
      width: inner,
      align: "center",
      characterSpacing: 0.8,
    });

  doc
    .fillColor(GREEN)
    .font("Helvetica-Bold")
    .fontSize(26)
    .text(money(contribution.amountPaid), left, boxTop + 32, {
      width: inner,
      align: "center",
    });

  // Le montant en lettres fait foi contre celui en chiffres.
  doc
    .fillColor(INK)
    .font("Helvetica-Oblique")
    .fontSize(10)
    .text(
      `Soit ${toFrenchWords(contribution.amountPaid)} francs CFA`,
      left,
      boxTop + 66,
      { width: inner, align: "center" }
    );

  // ---- Détail -----------------------------------------------------
  const rows = [
    ["Membre", memberLine(contribution)],
    ["Matricule", contribution.member?.registrationNumber || "—"],
    ["Église", memberChurchLabel],
    ["Bergerie", contribution.member?.flock?.name || "—"],
    ["Période", periodLabel(contribution.month, contribution.year)],
    ["Date du paiement", formatDate(contribution.paidAt)],
    ["Agent", contribution.recordedBy?.name || "—"],
    ["Statut", STATUS_LABELS[contribution.status] ?? contribution.status ?? "—"],
  ];

  let y = boxTop + 128;

  doc.font("Helvetica").fontSize(10.5);

  for (const [label, value] of rows) {
    doc.fillColor(SOFT).text(label, left, y, { width: inner * 0.42 });

    doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .text(String(value), left + inner * 0.42, y, {
        width: inner * 0.58,
      });

    doc.font("Helvetica");

    y += 17;

    doc
      .moveTo(left, y + 4)
      .lineTo(right, y + 4)
      .strokeColor("#eef2f0")
      .lineWidth(1)
      .stroke();

    y += 14;
  }

  // ---- Vérification -----------------------------------------------
  const qrTop = y + 22;

  doc.image(qrBuffer, left, qrTop, { width: 86 });

  doc
    .fillColor(INK)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("Traçabilité", left + 104, qrTop + 6, { width: inner - 104 });

  doc
    .fillColor(SOFT)
    .font("Helvetica")
    .fontSize(9)
    .text(
      "Ce code rappelle la référence de cette offrande dans le tableau " +
        "de bord du Service Social. Seule la base de données de l'église fait foi.",
      left + 104,
      qrTop + 22,
      { width: inner - 104, lineGap: 2 }
    );

  // ---- Pied de page -----------------------------------------------
  const footTop = doc.page.height - doc.page.margins.bottom - 76;

  doc
    .moveTo(left, footTop)
    .lineTo(right, footTop)
    .strokeColor("#e2e9e5")
    .stroke();

  doc
    .fillColor(SOFT)
    .font("Helvetica")
    .fontSize(8)
    .text(
      "Ce document atteste d'une offrande au Service Social du Centre " +
        "Apostolique Vie et Abondance. Il ne constitue pas un reçu fiscal.",
      left,
      footTop + 12,
      { width: inner, align: "center" }
    );

  doc
    .font("Helvetica-Oblique")
    .fontSize(9)
    .fillColor(GREEN)
    .text(
      "« Portez les fardeaux les uns des autres, et vous accomplirez ainsi " +
        "la loi de Christ. » — Galates 6:2",
      left,
      footTop + 36,
      { width: inner, align: "center", lineGap: 2 }
    );

  doc.end();

  return done;
};

// Nom de fichier proposé au téléchargement — porte la référence, pour
// les mêmes raisons que receipt.service.js#receiptFilename.
export const contributionReceiptFilename = (contribution) =>
  `recu-social-${contribution.reference}.pdf`;
