import PDFDocument from "pdfkit";
import QRCode from "qrcode";

import Settings from "../models/Settings.js";

import { env } from "../config/env.js";
import { toFrenchWords } from "../utils/frenchNumber.js";

// Génération du reçu de contribution.
//
// ------------------------------------------------------------------
// « REÇU DE CONTRIBUTION », PAS « REÇU FISCAL »
// ------------------------------------------------------------------
// Un reçu fiscal ouvrant droit à réduction d'impôt suppose que
// l'organisme y soit habilité par l'administration. Émettre un
// document qui en porte le nom sans cette habilitation expose l'église,
// et trompe le donateur qui croirait pouvoir le déduire.
//
// Le document atteste donc une contribution reçue — ce qui est vrai et
// vérifiable — et le dit explicitement en pied de page. Le jour où
// l'église obtient l'agrément, seule cette mention change.
//
// ------------------------------------------------------------------
// VÉRIFIABILITÉ
// ------------------------------------------------------------------
// Un PDF se retouche. Le reçu porte donc un QR code menant à la page
// de vérification du site, qui interroge la base : c'est elle qui fait
// foi, pas le papier. Un reçu falsifié se démasque en le scannant.

const GREEN = "#0d5b3e";
const GOLD = "#c9a227";
const INK = "#1f2a25";
const SOFT = "#6b746f";

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

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

// ------------------------------------------------------------------
// TEXTE COMPATIBLE AVEC LES POLICES DE BASE DU PDF
// ------------------------------------------------------------------
// Les polices standard d'un PDF (Helvetica ici) utilisent l'encodage
// WinAnsi, qui ne couvre pas tout l'Unicode. Les caractères absents ne
// provoquent aucune erreur : ils sont remplacés par un signe arbitraire
// ou purement supprimés, et la faute ne se découvre qu'en ouvrant le
// fichier.
//
// C'est ce qui s'est produit ici à la première génération :
//   - l'espace fine insécable de `toLocaleString("fr-FR")` ressortait
//     en barre oblique, donnant « 250 /000 F CFA » sur la ligne la
//     plus importante du reçu ;
//   - « cœur » perdait sa ligature et devenait « cur » ;
//   - le tiret cadratin disparaissait sans laisser de trace.
//
// Tout texte inséré dans le document passe donc par ce filtre. Les
// accents, eux, sont bien couverts par WinAnsi et n'ont besoin de rien.
const safe = (value) =>
  String(value ?? "")
    // Espaces insécables (fine ou normale) : une espace ordinaire.
    .replace(/[   ]/g, " ")
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

const TYPE_LABELS = {
  dime: "Dîme",
  offrande: "Offrande",
  don: "Don",
  grace: "Action de grâce",
  projet: "Projet spécial",
};

const PROJECT_LABELS = {
  general: "Œuvre générale",
  evangelisation: "Évangélisation",
  social: "Action sociale",
  formation: "Formation biblique",
  media: "Média & streaming",
  construction: "Construction",
};

const METHOD_LABELS = {
  orange: "Orange Money",
  mtn: "MTN Money",
  moov: "Moov Money",
  wave: "Wave",
  card: "Carte bancaire",
};

// Coordonnées de l'église. Lues dans les paramètres, avec repli : un
// reçu sans en-tête serait inexploitable, et l'absence d'un réglage ne
// doit pas empêcher le donateur d'obtenir son justificatif.
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

const donorLine = (donation) => {
  if (donation.donor?.anonymous) return "Donateur anonyme";

  const full = [donation.donor?.firstName, donation.donor?.lastName]
    .filter(Boolean)
    .join(" ");

  return full || "Non renseigné";
};

// Construit le PDF et le renvoie sous forme de Buffer.
//
// Un Buffer plutôt qu'un flux directement branché sur la réponse : en
// cas d'erreur en cours de génération, on peut encore répondre une
// erreur propre. Avec un flux, les en-têtes seraient déjà partis et le
// donateur recevrait un PDF tronqué.
export const buildReceipt = async (donation) => {
  const church = await churchIdentity();

  const verifyUrl = `${env.PUBLIC_SITE_URL}/donate/retour?ref=${donation.reference}`;

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
      Title: `Reçu de contribution ${donation.reference}`,
      Author: church.name,
      Subject: "Reçu de contribution",
    },
  });

  // Le filtre est posé UNE fois, sur le document lui-même.
  //
  // Appliquer `safe()` à chacun des quatorze appels fonctionnerait
  // aussi, mais il suffirait d'en oublier un — ou d'en ajouter un plus
  // tard — pour réintroduire le défaut. Et il ne se signalerait par
  // aucune erreur : seulement par un reçu abîmé entre les mains d'un
  // donateur.
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
    .fillColor("rgba(255,255,255,0.85)")
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
    .text("REÇU DE CONTRIBUTION", left, 168, {
      width: inner,
      align: "center",
      characterSpacing: 1.2,
    });

  doc
    .font("Helvetica")
    .fontSize(9.5)
    .fillColor(SOFT)
    .text(`Référence ${donation.reference}`, left, 192, {
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
    .text("MONTANT REÇU", left, boxTop + 16, {
      width: inner,
      align: "center",
      characterSpacing: 0.8,
    });

  doc
    .fillColor(GREEN)
    .font("Helvetica-Bold")
    .fontSize(26)
    .text(money(donation.amount), left, boxTop + 32, {
      width: inner,
      align: "center",
    });

  // Le montant en lettres fait foi contre celui en chiffres.
  doc
    .fillColor(INK)
    .font("Helvetica-Oblique")
    .fontSize(10)
    .text(
      `Soit ${toFrenchWords(donation.amount)} francs CFA`,
      left,
      boxTop + 66,
      { width: inner, align: "center" }
    );

  // ---- Détail -----------------------------------------------------
  const rows = [
    ["Reçu de", donorLine(donation)],
    ["Date du versement", formatDate(donation.paidAt ?? donation.createdAt)],
    [
      "Nature",
      TYPE_LABELS[donation.contributionType] ?? donation.contributionType,
    ],
    [
      "Affectation",
      PROJECT_LABELS[donation.project] ?? donation.project,
    ],
    [
      "Moyen de paiement",
      donation.paidWith ||
        METHOD_LABELS[donation.paymentMethod] ||
        donation.paymentMethod,
    ],
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
    .text("Vérifier ce reçu", left + 104, qrTop + 6, { width: inner - 104 });

  doc
    .fillColor(SOFT)
    .font("Helvetica")
    .fontSize(9)
    .text(
      "Scannez ce code pour confirmer en ligne l'authenticité de cette " +
        "contribution. Seule la base de données de l'église fait foi.",
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
      "Ce document atteste d'une contribution reçue. Il ne constitue pas " +
        "un reçu fiscal ouvrant droit à réduction d'impôt.",
      left,
      footTop + 12,
      { width: inner, align: "center" }
    );

  doc
    .font("Helvetica-Oblique")
    .fontSize(9)
    .fillColor(GREEN)
    .text(
      "« Que chacun donne comme il l'a résolu en son cœur, sans tristesse " +
        "ni contrainte ; car Dieu aime celui qui donne avec joie. » — 2 Corinthiens 9:7",
      left,
      footTop + 36,
      { width: inner, align: "center", lineGap: 2 }
    );

  doc.end();

  return done;
};

// Nom de fichier proposé au téléchargement.
//
// Il porte la référence : un donateur qui en télécharge plusieurs ne
// se retrouve pas avec « recu(1).pdf », « recu(2).pdf ».
export const receiptFilename = (donation) =>
  `recu-cava-${donation.reference}.pdf`;
