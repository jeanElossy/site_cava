import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync } from "node:fs";

import { createCanvas, loadImage } from "@napi-rs/canvas";
import QRCode from "qrcode";
import PDFDocument from "pdfkit";

import Member from "../models/Member.js";
// Import de pur enregistrement : jamais utilisé directement ici, mais
// `.populate("ministries", ...)` plus bas exige que le modèle
// "Ministry" soit connu de Mongoose avant le premier appel.
import "../models/Ministry.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import { isTrustedMemberPhotoUrl } from "../utils/cloudinaryUrl.js";
import { formatRegistrationNumber } from "./registrationNumber.service.js";
import {
  RASTER_SCALE,
  rewriteFontFamilies,
  inlineLocalImageHrefs,
  reflowMultiTspanText,
  parseSvgDocument,
  serializeSvg,
  requireElementById,
  setElementText,
  setElementImageSource,
  toDataUri,
  rasterizeSvgToPng,
} from "./svgCardRenderer.js";

// ------------------------------------------------------------------
// Gabarits Illustrator — LA référence visuelle. Ce module ne fait que
// remplacer le contenu texte ou la source image d'éléments désignés
// par leur `id` (voir CONTRAT D'ID ci-dessous). Il ne crée, ne
// déplace, ne redimensionne et ne recolore jamais rien : toute
// modification du design se fait dans Illustrator, jamais ici.
//
// CONTRAT D'ID (à nommer sur les calques/objets concernés avant
// export SVG depuis Illustrator, sous "IDs d'objet > Noms de
// calque") :
//
//   Recto :
//   field-nom             texte  — nom complet du membre
//   field-matricule       texte  — matricule formaté
//   field-role            texte  — fonction (rôle) du membre
//   field-date-naissance  texte  — date de naissance
//   field-contact         texte  — téléphone
//   field-quartier        texte  — quartier/lieu de résidence
//   field-ministere       texte  — ministère(s), facultatif
//   field-photo           image  — photo du membre (repli : initiales)
//   field-qr               image  — QR code (lien de mise à jour de fiche)
//
//   Verso : entièrement statique, aucun id `field-*` — pas d'injection.
const CARDS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../public/cards"
);

const SIGNATURES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../public/signatures"
);

// Résolus paresseusement (pas en constante au chargement du module) :
// les tests substituent un gabarit de secours via ces deux variables
// d'environnement tant que les gabarits réels n'ont pas encore le
// contrat d'id ci-dessus — la production, elle, n'en définit aucune
// et utilise toujours les vrais fichiers.
const getRectoPath = () =>
  process.env.MEMBER_CARD_RECTO_PATH_OVERRIDE ||
  path.join(CARDS_DIR, "recto.svg");

const getVersoPath = () =>
  process.env.MEMBER_CARD_VERSO_PATH_OVERRIDE ||
  path.join(CARDS_DIR, "verso.svg");

const readSvgTemplate = (filePath) =>
  inlineLocalImageHrefs(rewriteFontFamilies(readFileSync(filePath, "utf8")), SIGNATURES_DIR);

let cachedRectoTemplateSource = null;

// Le gabarit recto est relu et réinjecté à chaque carte (une par
// membre), mais sa LECTURE DISQUE + réécriture des polices ne dépend
// d'aucune donnée membre : mise en cache en mémoire au premier appel.
const getRectoTemplateSource = () => {
  if (!cachedRectoTemplateSource) {
    cachedRectoTemplateSource = readSvgTemplate(getRectoPath());
  }

  return cachedRectoTemplateSource;
};

const toTitleCase = (value = "") =>
  value
    .toLowerCase()
    .replace(/(^|[\s-])\p{L}/gu, (match) => match.toUpperCase());

const initialsOf = (firstName, lastName) =>
  [firstName, lastName]
    .filter(Boolean)
    .map((part) => part.trim()[0]?.toUpperCase())
    .filter(Boolean)
    .join("") || "?";

// Repli quand le membre n'a pas encore envoyé de photo : une pastille
// à initiales, rendue en PNG puis injectée exactement comme une vraie
// photo — le gabarit ne voit jamais la différence.
//
// `ratio` (largeur / hauteur) suit celui du cadre du gabarit, comme la
// vraie photo : un repli carré dans un cadre portrait se ferait
// recadrer sur les côtés par le `preserveAspectRatio="slice"` du SVG.
const buildInitialsAvatarPng = (firstName, lastName, width = 320, ratio = 1) => {
  const height = Math.round(width / ratio);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#faf8f3";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#083b2a";
  ctx.font = `bold ${Math.round(Math.min(width, height) * 0.4)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initialsOf(firstName, lastName), width / 2, height / 2 + 2);

  return canvas.toBuffer("image/png");
};

// Proportions du cadre photo tel qu'il est réellement dessiné dans le
// gabarit (`<rect id="field-photo">` de recto.svg).
//
// Lues sur le gabarit plutôt que codées en dur : le cadre est PORTRAIT
// (63,8 × 80,76 aujourd'hui), alors que la photo était jusqu'ici
// recadrée en CARRÉ. Le SVG rattrapait la différence avec un
// `preserveAspectRatio="xMidYMid slice"`, c'est-à-dire un SECOND
// recadrage, centré celui-là — qui annulait l'ancrage vers le haut et
// coupait le sommet des têtes. En produisant directement l'image au
// bon rapport, ce second recadrage n'a plus rien à retirer.
const PHOTO_FRAME_FALLBACK_RATIO = 63.8 / 80.76;

const photoFrameRatio = (document) => {
  const frame = document.getElementById("field-photo");

  const width = Number(frame?.getAttribute("width"));
  const height = Number(frame?.getAttribute("height"));

  if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) {
    return PHOTO_FRAME_FALLBACK_RATIO;
  }

  return width / height;
};

const loadMemberForCard = async (memberId) => {
  const member = await Member.findById(memberId)
    .populate("ministries", "name")
    .lean();

  if (!member) {
    throw ApiError.notFound("Membre introuvable.");
  }

  if (!member.registrationNumber) {
    throw ApiError.unprocessable(
      "Ce membre n'a pas encore de matricule : aucune carte ne peut être générée."
    );
  }

  if (member.status === "inactif") {
    throw ApiError.forbidden(
      "Ce membre est désactivé : aucune carte ne peut être générée ou téléchargée pour lui."
    );
  }

  return member;
};

const PHOTO_OUTPUT_WIDTH = 320;

const buildMemberPhotoDataUri = async (member, ratio) => {
  const targetWidth = PHOTO_OUTPUT_WIDTH;
  const targetHeight = Math.round(targetWidth / ratio);

  if (member.photo && isTrustedMemberPhotoUrl(member.photo)) {
    try {
      // `loadImage` sait aussi bien décoder qu'aller chercher l'URL :
      // on s'en sert uniquement pour valider que la photo est bien
      // accessible et décodable avant de la ré-encoder au format du
      // cadre (recadrage « cover », JAMAIS d'étirement).
      const photoImage = await loadImage(member.photo);

      // Plus grande zone de la source ayant le rapport du cadre.
      let sourceWidth = photoImage.width;
      let sourceHeight = Math.round(sourceWidth / ratio);

      if (sourceHeight > photoImage.height) {
        sourceHeight = photoImage.height;
        sourceWidth = Math.round(sourceHeight * ratio);
      }

      const sourceX = (photoImage.width - sourceWidth) / 2;

      // Recadrage vertical ancré vers le haut plutôt que centré : sans
      // détection de visage, un centrage strict coupait régulièrement
      // le sommet de la tête sur les photos portrait (où le visage
      // occupe surtout la moitié haute du cadre, avec de l'espace
      // libre sous les épaules). Ne retire qu'une fraction modeste de
      // l'excédent vertical en haut, le reste en bas.
      const sourceY = (photoImage.height - sourceHeight) * 0.15;

      const canvas = createCanvas(targetWidth, targetHeight);
      const ctx = canvas.getContext("2d");

      ctx.drawImage(
        photoImage,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        targetWidth,
        targetHeight
      );

      return toDataUri(canvas.toBuffer("image/png"), "image/png");
    } catch {
      // URL cassée ou hôte injoignable au moment du rendu : repli sur
      // les initiales plutôt que de faire échouer toute la carte.
    }
  }

  return toDataUri(
    buildInitialsAvatarPng(
      member.firstName,
      member.lastName,
      targetWidth,
      ratio
    ),
    "image/png"
  );
};

const buildQrDataUri = async (member) => {
  // Lien simple et permanent, IDENTIQUE au format déjà utilisé en
  // production aujourd'hui (memberCard.service.js) — ce même QR est
  // aussi scanné par les agents de service d'ordre pour badger la
  // présence à un événement (voir presence.service.js) : changer ce
  // format casserait ce second usage sans toucher à une seule ligne
  // du système de présence.
  const qrContent = `${env.PUBLIC_SITE_URL}/inscription?matricule=${encodeURIComponent(
    member.registrationNumber
  )}`;

  const buffer = await QRCode.toBuffer(qrContent, {
    type: "png",
    width: 320,
    margin: 0,
    color: { dark: "#083b2a", light: "#ffffff" },
  });

  return toDataUri(buffer, "image/png");
};

const formatDate = (date) =>
  date
    ? date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";

// Libellés affichés sur la carte pour chaque valeur de `role` — DOIT
// rester synchronisé avec MEMBER_ROLES dans
// src/pages/admin/CommunityAdmin.jsx (la carte affiche le libellé
// destiné à l'utilisateur, jamais la valeur brute stockée en base :
// "pasteur" s'affiche "PASTEUR PRINCIPAL", pas "PASTEUR").
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

const injectRectoFields = async (document, member) => {
  // Nom-Prénom, comme le libellé du gabarit recto.svg (voir
  // CommunityAdmin.jsx#memberColumns, aligné sur ce même ordre) — pas
  // l'ordre inverse utilisé un temps ici.
  const fullName = [
    member.lastName ? member.lastName.toUpperCase() : "",
    toTitleCase(member.firstName ?? ""),
  ]
    .filter(Boolean)
    .join(" ");

  const matricule = formatRegistrationNumber(member.registrationNumber);
  const birthDate = member.dateOfBirth ? new Date(member.dateOfBirth) : null;
  const contact = member.phone || member.whatsapp || "—";

  setElementText(
    requireElementById(document, "field-nom", "recto.svg"),
    fullName
  );
  setElementText(
    requireElementById(document, "field-matricule", "recto.svg"),
    matricule
  );
  const roleLabel = ROLE_LABELS[member.role] ?? ROLE_LABELS.membre;

  setElementText(
    requireElementById(document, "field-role", "recto.svg"),
    roleLabel.toUpperCase()
  );
  setElementText(
    requireElementById(document, "field-date-naissance", "recto.svg"),
    formatDate(birthDate)
  );
  setElementText(
    requireElementById(document, "field-contact", "recto.svg"),
    contact
  );
  setElementText(
    requireElementById(document, "field-quartier", "recto.svg"),
    member.area || "—"
  );

  // Champ facultatif : absent du gabarit actuel (voir contrat d'id en
  // tête de fichier) — n'échoue pas tant qu'il n'a pas été ajouté par
  // vous dans Illustrator.
  const ministereElement = document.getElementById("field-ministere");

  if (ministereElement) {
    const ministryNames = (member.ministries ?? [])
      .map((ministry) => ministry?.name)
      .filter(Boolean);

    setElementText(
      ministereElement,
      ministryNames.length > 0 ? ministryNames.join(", ") : "—"
    );
  }

  const photoDataUri = await buildMemberPhotoDataUri(
    member,
    photoFrameRatio(document)
  );
  setElementImageSource(
    requireElementById(document, "field-photo", "recto.svg"),
    photoDataUri
  );

  const qrDataUri = await buildQrDataUri(member);
  setElementImageSource(
    requireElementById(document, "field-qr", "recto.svg"),
    qrDataUri
  );
};

const buildRectoPng = async (member) => {
  const source = getRectoTemplateSource();
  const document = parseSvgDocument(source);

  await injectRectoFields(document, member);
  reflowMultiTspanText(document, source);

  return rasterizeSvgToPng(serializeSvg(document));
};

let cachedVersoPng = null;

// Le verso est entièrement statique (aucun id `field-*`, voir contrat
// d'id) : identique pour tous les membres, rasterisé une seule fois
// puis réutilisé.
const buildVersoPng = () => {
  if (!cachedVersoPng) {
    const source = readSvgTemplate(getVersoPath());
    const document = parseSvgDocument(source);

    reflowMultiTspanText(document, source);
    cachedVersoPng = rasterizeSvgToPng(serializeSvg(document));
  }

  return cachedVersoPng;
};

// PNG -> JPEG : `resvg-js` ne rasterise qu'en PNG. On réutilise
// `@napi-rs/canvas`, déjà en dépendance, plutôt que d'ajouter une
// librairie dédiée pour cette seule conversion.
const pngToJpeg = async (pngBuffer) => {
  const image = await loadImage(pngBuffer);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(image, 0, 0);

  return canvas.toBuffer("image/jpeg", 0.92);
};

// Carte numérique : recto seul, format le plus utile à l'écran (voir
// design validé).
export const buildMemberCardJpeg = async (memberId) => {
  const member = await loadMemberForCard(memberId);
  const rectoPng = await buildRectoPng(member);

  return pngToJpeg(rectoPng);
};

export const buildMemberCardVersoJpeg = async (memberId) => {
  await loadMemberForCard(memberId);
  const versoPng = buildVersoPng();

  return pngToJpeg(versoPng);
};

// Carte imprimable : PDF 2 pages (recto, verso) aux dimensions
// physiques du gabarit — une page par face, jamais fusionnées en une
// seule image.
export const buildMemberCardPdf = async (memberId) => {
  const member = await loadMemberForCard(memberId);
  const rectoPng = await buildRectoPng(member);
  const versoPng = buildVersoPng();

  const rectoImage = await loadImage(rectoPng);
  const pageWidth = rectoImage.width / RASTER_SCALE;
  const pageHeight = rectoImage.height / RASTER_SCALE;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [pageWidth, pageHeight],
      margin: 0,
      autoFirstPage: false,
    });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.addPage();
    doc.image(rectoPng, 0, 0, { width: pageWidth, height: pageHeight });

    doc.addPage();
    doc.image(versoPng, 0, 0, { width: pageWidth, height: pageHeight });

    doc.end();
  });
};
