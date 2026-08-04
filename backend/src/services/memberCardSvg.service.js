import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync } from "node:fs";

import { DOMParser } from "linkedom";
import { Resvg } from "@resvg/resvg-js";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import QRCode from "qrcode";
import PDFDocument from "pdfkit";

import Member from "../models/Member.js";
import Church from "../models/Church.js";
// Import de pur enregistrement : jamais utilisé directement ici, mais
// `.populate("ministries", ...)` plus bas exige que le modèle
// "Ministry" soit connu de Mongoose avant le premier appel.
import "../models/Ministry.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import { isTrustedMemberPhotoUrl } from "../utils/cloudinaryUrl.js";
import { formatRegistrationNumber } from "./registrationNumber.service.js";

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
//   field-nom             texte  — nom complet du membre
//   field-matricule       texte  — matricule formaté
//   field-annee-arrivee   texte  — année d'inscription
//   field-expiration      texte  — date de validité (inscription + 1 an)
//   field-bergerie        texte  — nom de la bergerie
//   field-assemblee       texte  — nom de l'assemblée (église)
//   field-ministere       texte  — ministère(s), facultatif
//   field-photo           image  — photo du membre (repli : initiales)
//   field-qr               image  — QR code (lien de mise à jour de fiche)
//
// Le verso n'a aucun champ dynamique : il est rasterisé tel quel et
// mis en cache.
const CARDS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../public/cards"
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

// Résolution de rasterisation. Les gabarits sont en points (viewBox
// ~315 x 225, cohérent avec le format badge déjà utilisé) : x8 donne
// un rendu net à l'impression sans imposer un poids de fichier
// disproportionné.
const RASTER_SCALE = 8;

// ------------------------------------------------------------------
// Polices — SUBSTITUTION VALIDÉE, seule exception au principe "jamais
// toucher au design".
//
// Les gabarits Illustrator déclarent des polices commerciales
// (Acumin Variable Concept, sous licence Adobe) et une police
// explicitement "PERSONAL USE" (Byliner Script) que nous n'avons pas
// le droit d'embarquer sur le serveur. On les remplace par Poppins
// (Regular/Bold), déjà sous licence SIL OFL et déjà embarquée pour
// l'ancienne carte (voir assets/fonts/OFL.txt) — seule la police
// change, jamais la taille, la couleur, l'espacement ou la position
// du texte.
//
// Règle de correspondance : tout nom de police contenant
// "bold"/"black"/"medium" (insensible à la casse) devient Poppins
// Bold, le reste devient Poppins Regular — évite une table de
// correspondance figée par nom exact de police, qui se périmerait au
// moindre nouvel export Illustrator.
const FONTS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../assets/fonts"
);
const POPPINS_REGULAR_PATH = path.join(FONTS_DIR, "Poppins-Regular.ttf");
const POPPINS_BOLD_PATH = path.join(FONTS_DIR, "Poppins-Bold.ttf");
const CARD_FONT_FAMILY = "Poppins";

const RESVG_FONT_OPTIONS = {
  fontFiles: [POPPINS_REGULAR_PATH, POPPINS_BOLD_PATH],
  loadSystemFonts: false,
  defaultFontFamily: CARD_FONT_FAMILY,
};

const rewriteFontFamilies = (svgSource) =>
  svgSource.replace(/font-family:\s*([^;]+);/g, (match, families) => {
    const weight = /bold|black|medium/i.test(families) ? 700 : 400;

    return `font-family: ${CARD_FONT_FAMILY}; font-weight: ${weight};`;
  });

let cachedVersoPng = null;
let cachedRectoTemplateSource = null;

const readSvgTemplate = (filePath) =>
  rewriteFontFamilies(readFileSync(filePath, "utf8"));

// Le gabarit recto est relu et réinjecté à chaque carte (une par
// membre), mais sa LECTURE DISQUE + réécriture des polices ne dépend
// d'aucune donnée membre : mise en cache en mémoire au premier appel,
// comme le fait déjà l'enregistrement des polices dans l'ancien
// service canvas.
const getRectoTemplateSource = () => {
  if (!cachedRectoTemplateSource) {
    cachedRectoTemplateSource = readSvgTemplate(getRectoPath());
  }

  return cachedRectoTemplateSource;
};

// Analyse en mode XML strict (`image/svg+xml`), PAS `parseHTML` : un
// parseur HTML applique les règles d'insertion "contenu étranger" du
// HTML5 pour le SVG imbriqué, incomplètes dans linkedom pour certains
// éléments peu courants — les primitives de filtre (`feComposite`
// notamment, utilisées par l'ombre portée du badge "MEMBRE ACTIF")
// disparaissaient silencieusement au moment de resérialiser le
// document, invalidant le filtre et rendant TOUT l'élément qui le
// référence invisible (comportement du spec SVG pour une référence de
// filtre brisée). Le mode XML strict préserve fidèlement l'intégralité
// du document, y compris ces éléments.
const parseSvgDocument = (svgSource) => {
  const parser = new DOMParser();

  return parser.parseFromString(svgSource, "image/svg+xml");
};

const serializeSvg = (document) => {
  const svgElement = document.documentElement;

  if (!svgElement || svgElement.tagName?.toLowerCase() !== "svg") {
    throw new Error("Gabarit de carte invalide : aucun élément <svg> trouvé.");
  }

  return svgElement.outerHTML;
};

const requireElementById = (document, id, templateName) => {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(
      `Gabarit "${templateName}" incomplet : aucun élément avec id="${id}" — ` +
        "voir le contrat d'id documenté en tête de memberCardSvg.service.js."
    );
  }

  return element;
};

// Remplace le texte d'un élément SANS toucher à sa position ni sa
// police. Un export Illustrator éclate en général le texte en
// PLUSIEURS <tspan>, un par caractère ou par groupe de caractères
// portant le même style, chacun avec son propre x/y calculé pour un
// crénage manuel précis — remplacer seulement le contenu d'un seul de
// ces tspans laisserait les autres afficher l'ancien texte factice à
// côté du nouveau. On repart donc du point d'ancrage du PREMIER tspan
// (là où le texte doit commencer) et on le remplace par un tspan
// unique portant la nouvelle valeur ; la position/police/couleur de
// l'élément <text> lui-même (transform, class CSS) ne bougent pas.
// Sans tspan (élément <text> simple), le texte est remplacé
// directement.
const setElementText = (element, value) => {
  const tspans = [...element.querySelectorAll("tspan")];

  if (tspans.length === 0) {
    element.textContent = value;

    return;
  }

  const anchor = tspans[0];
  const x = anchor.getAttribute("x");
  const y = anchor.getAttribute("y");

  for (const tspan of tspans) tspan.remove();

  const replacement = element.ownerDocument.createElement("tspan");

  if (x !== null) replacement.setAttribute("x", x);
  if (y !== null) replacement.setAttribute("y", y);
  replacement.textContent = value;

  element.appendChild(replacement);
};

// Certains gabarits ne portent pas encore d'élément <image> dédié pour
// la photo/le QR, seulement la FORME qui délimite leur zone (un <rect>
// arrondi servant de cadre — voir le contrat d'id). Dans ce cas, une
// <image> est insérée juste après ce cadre, aux mêmes x/y/largeur/
// hauteur/rayon d'angle : le cadre existant (son remplissage et son
// contour, définis dans Illustrator) reste affiché tel quel, la photo
// vient seulement combler l'intérieur — rien n'est déplacé ni
// redimensionné, la géométrie vient entièrement du gabarit lui-même.
const setElementImageSource = (element, dataUri) => {
  const tagName = element.tagName?.toLowerCase();

  if (tagName === "image") {
    element.setAttribute("href", dataUri);
    element.setAttribute("xlink:href", dataUri);

    return;
  }

  if (tagName === "rect") {
    const document = element.ownerDocument;
    const x = element.getAttribute("x");
    const y = element.getAttribute("y");
    const width = element.getAttribute("width");
    const height = element.getAttribute("height");
    const rx = element.getAttribute("rx");
    const ry = element.getAttribute("ry");

    const image = document.createElement("image");

    image.setAttribute("x", x);
    image.setAttribute("y", y);
    image.setAttribute("width", width);
    image.setAttribute("height", height);
    image.setAttribute("preserveAspectRatio", "xMidYMid slice");
    image.setAttribute("href", dataUri);
    image.setAttribute("xlink:href", dataUri);

    if (rx !== null || ry !== null) {
      const clipId = `${element.getAttribute("id")}-clip`;
      const clipPath = document.createElement("clipPath");
      const clipRect = document.createElement("rect");

      clipPath.setAttribute("id", clipId);
      clipRect.setAttribute("x", x);
      clipRect.setAttribute("y", y);
      clipRect.setAttribute("width", width);
      clipRect.setAttribute("height", height);
      if (rx !== null) clipRect.setAttribute("rx", rx);
      if (ry !== null) clipRect.setAttribute("ry", ry);

      clipPath.appendChild(clipRect);
      element.parentNode.insertBefore(clipPath, element.nextSibling);
      image.setAttribute("clip-path", `url(#${clipId})`);
    }

    element.parentNode.insertBefore(image, element.nextSibling);

    return;
  }

  throw new Error(
    `L'élément id="${element.getAttribute("id")}" (balise <${tagName}>) n'est ` +
      "ni une <image> ni un <rect> — impossible d'y injecter une photo ou un QR code."
  );
};

const toDataUri = (buffer, mime) =>
  `data:${mime};base64,${buffer.toString("base64")}`;

const rasterizeSvgToPng = (svgSource) => {
  const resvg = new Resvg(svgSource, {
    fitTo: { mode: "zoom", value: RASTER_SCALE },
    font: RESVG_FONT_OPTIONS,
  });

  return resvg.render().asPng();
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
const buildInitialsAvatarPng = (firstName, lastName, size = 240) => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#faf8f3";
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = "#083b2a";
  ctx.font = `bold ${Math.round(size * 0.4)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initialsOf(firstName, lastName), size / 2, size / 2 + 2);

  return canvas.toBuffer("image/png");
};

const loadMemberForCard = async (memberId) => {
  const member = await Member.findById(memberId)
    .populate("flock", "name")
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

  const church = member.church
    ? await Church.findOne({ number: member.church }).lean()
    : null;

  return { member, church };
};

const buildMemberPhotoDataUri = async (member) => {
  if (member.photo && isTrustedMemberPhotoUrl(member.photo)) {
    try {
      // `loadImage` sait aussi bien décoder qu'aller chercher l'URL :
      // on s'en sert uniquement pour valider que la photo est bien
      // accessible et décodable avant de la ré-encoder en PNG carré
      // (recadrage "cover"), taille cohérente avec le repli initiales.
      const photoImage = await loadImage(member.photo);
      const size = Math.min(photoImage.width, photoImage.height);
      const sourceX = (photoImage.width - size) / 2;
      const sourceY = (photoImage.height - size) / 2;

      const canvas = createCanvas(320, 320);
      const ctx = canvas.getContext("2d");

      ctx.drawImage(photoImage, sourceX, sourceY, size, size, 0, 0, 320, 320);

      return toDataUri(canvas.toBuffer("image/png"), "image/png");
    } catch {
      // URL cassée ou hôte injoignable au moment du rendu : repli sur
      // les initiales plutôt que de faire échouer toute la carte.
    }
  }

  return toDataUri(
    buildInitialsAvatarPng(member.firstName, member.lastName),
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

const injectRectoFields = async (document, member, church) => {
  const fullName = [
    toTitleCase(member.firstName ?? ""),
    member.lastName ? member.lastName.toUpperCase() : "",
  ]
    .filter(Boolean)
    .join(" ");

  const joinedDate = member.joinedAt ? new Date(member.joinedAt) : null;
  const joinedYear = joinedDate ? joinedDate.getFullYear() : null;

  const expirationDate = joinedDate
    ? new Date(
        joinedDate.getFullYear() + 1,
        joinedDate.getMonth(),
        joinedDate.getDate()
      )
    : null;

  const formatDate = (date) =>
    date
      ? date.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "—";

  const churchName = church?.name ?? `Église ${member.church}`;
  const flockName = member.flock?.name ?? "—";
  const matricule = formatRegistrationNumber(member.registrationNumber);

  setElementText(
    requireElementById(document, "field-nom", "recto.svg"),
    fullName
  );
  setElementText(
    requireElementById(document, "field-matricule", "recto.svg"),
    matricule
  );
  setElementText(
    requireElementById(document, "field-annee-arrivee", "recto.svg"),
    joinedYear ? String(joinedYear) : "—"
  );
  setElementText(
    requireElementById(document, "field-expiration", "recto.svg"),
    formatDate(expirationDate)
  );
  setElementText(
    requireElementById(document, "field-bergerie", "recto.svg"),
    flockName
  );
  setElementText(
    requireElementById(document, "field-assemblee", "recto.svg"),
    churchName
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

  const photoDataUri = await buildMemberPhotoDataUri(member);
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

const buildRectoPng = async (memberId) => {
  const { member, church } = await loadMemberForCard(memberId);

  const document = parseSvgDocument(getRectoTemplateSource());

  await injectRectoFields(document, member, church);

  return rasterizeSvgToPng(serializeSvg(document));
};

const buildVersoPng = () => {
  if (!cachedVersoPng) {
    cachedVersoPng = rasterizeSvgToPng(readSvgTemplate(getVersoPath()));
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
// design validé — le verso ne change jamais, inutile à afficher).
export const buildMemberCardJpeg = async (memberId) => {
  const rectoPng = await buildRectoPng(memberId);

  return pngToJpeg(rectoPng);
};

export const buildMemberCardVersoJpeg = async (memberId) => {
  // Le verso ne dépend d'aucune donnée du membre, mais on vérifie
  // quand même son existence/statut : pas de fuite d'un verso pour un
  // membre introuvable ou désactivé.
  await loadMemberForCard(memberId);

  return pngToJpeg(buildVersoPng());
};

// Carte imprimable : PDF 2 pages (recto, verso) aux dimensions
// physiques du gabarit — une page par face, jamais fusionnées en une
// seule image.
export const buildMemberCardPdf = async (memberId) => {
  const rectoPng = await buildRectoPng(memberId);
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
