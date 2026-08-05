import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync } from "node:fs";

import { DOMParser } from "linkedom";
import { Resvg } from "@resvg/resvg-js";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
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

// Même Poppins, mais enregistrée séparément auprès de @napi-rs/canvas
// (utilisé ici uniquement pour MESURER du texte — voir
// reflowMultiTspanText — jamais pour dessiner la carte elle-même,
// toujours rasterisée par resvg-js).
const CANVAS_FONT_REGULAR = "CavaCardMeasureRegular";
const CANVAS_FONT_BOLD = "CavaCardMeasureBold";

GlobalFonts.registerFromPath(POPPINS_REGULAR_PATH, CANVAS_FONT_REGULAR);
GlobalFonts.registerFromPath(POPPINS_BOLD_PATH, CANVAS_FONT_BOLD);

const textMeasureContext = createCanvas(10, 10).getContext("2d");

const rewriteFontFamilies = (svgSource) =>
  svgSource.replace(/font-family:\s*([^;]+);/g, (match, families) => {
    const weight = /bold|black|medium/i.test(families) ? 700 : 400;

    return `font-family: ${CARD_FONT_FAMILY}; font-weight: ${weight};`;
  });

// Lit une propriété CSS (`property`) pour une classe donnée dans le
// bloc <style> du gabarit — les règles y sont souvent groupées par
// sélecteur multiple (ex. ".cls-12, .cls-41 { font-size: 5px; }"),
// d'où la recherche par appartenance à la liste plutôt qu'un sélecteur
// exact.
const getStylePropertyForClass = (svgSource, className, property) => {
  const styleStart = svgSource.indexOf("<style");

  if (styleStart === -1) return null;

  const bodyStart = svgSource.indexOf(">", styleStart) + 1;
  const styleEnd = svgSource.indexOf("</style>", bodyStart);

  if (styleEnd === -1) return null;

  const css = svgSource.slice(bodyStart, styleEnd);
  const target = `.${className}`;

  for (const rule of css.split("}")) {
    const braceIndex = rule.indexOf("{");

    if (braceIndex === -1) continue;

    const selectors = rule
      .slice(0, braceIndex)
      .split(",")
      .map((selector) => selector.trim());

    if (!selectors.includes(target)) continue;

    const match = rule
      .slice(braceIndex + 1)
      .match(new RegExp(`${property}:\\s*([^;]+);`));

    if (match) return match[1].trim();
  }

  return null;
};

// Taille et graisse effectives d'un élément <text>, lues dans le bloc
// <style> via ses classes CSS — nécessaires pour mesurer précisément
// le texte avec la police de substitution (voir reflowMultiTspanText).
// `null` si la taille n'a pas pu être déterminée : mieux vaut renoncer
// au repositionnement que deviner une taille fausse.
const resolveFontMetrics = (svgSource, element) => {
  const classes = (element.getAttribute("class") ?? "")
    .split(/\s+/)
    .filter(Boolean);

  let fontSize = null;
  let fontWeight = null;

  for (const className of classes) {
    fontSize ??= getStylePropertyForClass(svgSource, className, "font-size");
    fontWeight ??= getStylePropertyForClass(svgSource, className, "font-weight");
  }

  if (!fontSize) return null;

  return {
    fontSizePx: parseFloat(fontSize),
    bold: fontWeight ? parseInt(fontWeight, 10) >= 700 : false,
  };
};

// GARDE-FOU GÉNÉRAL contre la substitution de police (voir plus haut) :
// un export Illustrator positionne souvent le texte en plusieurs
// <tspan>, un par caractère ou par groupe portant le même style,
// chacun avec un x calculé au pixel près pour LA POLICE D'ORIGINE.
// Une fois cette police remplacée par Poppins (largeurs de caractère
// différentes), ces x figés ne correspondent plus à rien : lettres qui
// se chevauchent ou espaces qui s'ouvrent au mauvais endroit — visible
// sur les textes décoratifs (devise, "CARTE VALIDE JUSQU'AU"...) que
// le code ne modifie jamais autrement.
//
// Recalcule le x de chaque tspan à partir de la largeur RÉELLEMENT
// mesurée (avec la police de substitution) des tspans précédents,
// plutôt que de faire confiance aux x d'origine — jamais de nouveau
// texte, jamais de changement de taille/couleur/position verticale,
// seulement une réédition de la position horizontale pour qu'elle
// corresponde à la police réellement utilisée.
//
// Les champs dynamiques (id `field-*`) sont ignorés : `setElementText`
// les a déjà réduits à un tspan unique, rien à recalculer.
// Un même <text> peut porter plusieurs LIGNES (motto sur deux lignes,
// légende du logo…), chaque nouvelle ligne repérable à un `y` de
// tspan différent du précédent — regroupées ici pour être traitées
// indépendamment (voir reflowMultiTspanText).
const groupTspansIntoLines = (tspans) => {
  const lines = [];
  let currentY = null;

  for (const tspan of tspans) {
    const y = tspan.getAttribute("y");

    if (lines.length === 0 || y !== currentY) {
      currentY = y;
      lines.push([]);
    }

    lines[lines.length - 1].push(tspan);
  }

  return lines;
};

// Positionne une ligne de tspans à une taille de police donnée, sans
// écrire quoi que ce soit dans le document — un simple calcul, appelé
// une ou deux fois par reflowMultiTspanText (la seconde en cas de
// réduction de taille).
const layoutLine = (lineTspans, fontSizePx, bold) => {
  textMeasureContext.font = `${fontSizePx}px ${
    bold ? CANVAS_FONT_BOLD : CANVAS_FONT_REGULAR
  }`;

  const positions = [];
  let cursorX = null;
  let previousOriginalX = null;
  let previousMeasuredWidth = 0;

  for (const tspan of lineTspans) {
    const originalX = parseFloat(tspan.getAttribute("x") ?? "0");

    if (cursorX === null) {
      cursorX = originalX;
    } else {
      // Avance d'AU MOINS la largeur réellement mesurée du tspan
      // précédent (empêche tout chevauchement avec la police de
      // substitution), mais jamais moins que l'écart voulu par le
      // gabarit d'origine (`originalGap`) : certains tspans ne se
      // suivent pas au pixel près par kerning fin, mais par un
      // espacement délibérément généreux — ex. la lettre "Ç" du logo
      // CAVA dans sa pastille colorée, suivie du mot "entre" bien plus
      // loin que sa seule largeur de glyphe. Prendre le maximum des
      // deux respecte les deux cas sans avoir à les distinguer
      // explicitement.
      const originalGap = originalX - previousOriginalX;

      cursorX += Math.max(previousMeasuredWidth, originalGap);
    }

    const measuredWidth = textMeasureContext.measureText(
      tspan.textContent
    ).width;

    positions.push({ tspan, x: cursorX, width: measuredWidth });

    previousOriginalX = originalX;
    previousMeasuredWidth = measuredWidth;
  }

  const first = positions[0];
  const last = positions[positions.length - 1];

  return { positions, totalWidth: last.x + last.width - first.x };
};

const reflowMultiTspanText = (document, svgSource) => {
  for (const textElement of document.querySelectorAll("text")) {
    const id = textElement.getAttribute("id");

    if (id?.startsWith("field-")) continue;

    const allTspans = [...textElement.querySelectorAll("tspan")];

    if (allTspans.length < 2) continue;

    const metrics = resolveFontMetrics(svgSource, textElement);

    if (!metrics) continue;

    for (const lineTspans of groupTspansIntoLines(allTspans)) {
      if (lineTspans.length < 2) continue;

      let fontSizePx = metrics.fontSizePx;
      let layout = layoutLine(lineTspans, fontSizePx, metrics.bold);

      // GARDE-FOU : la police de substitution peut être plus large que
      // l'originale au point de faire déborder toute la ligne au-delà
      // de son empan d'origine (ex. la légende du logo débordant du
      // bandeau vert sur lequel elle est posée) — un problème
      // d'ampleur globale que l'espacement au cas par cas ci-dessus ne
      // peut pas résoudre. `originalBudget` réutilise la même mesure
      // (police de substitution, même taille) pour son dernier
      // caractère : une comparaison à mesure égale, jamais une
      // estimation de la police d'origine que nous n'avons pas le
      // droit d'embarquer.
      const originalFirstX = parseFloat(
        lineTspans[0].getAttribute("x") ?? "0"
      );
      const originalLastX = parseFloat(
        lineTspans[lineTspans.length - 1].getAttribute("x") ?? "0"
      );
      const lastMeasuredWidth =
        layout.positions[layout.positions.length - 1].width;
      const originalBudget =
        originalLastX - originalFirstX + lastMeasuredWidth;

      if (originalBudget > 0 && layout.totalWidth > originalBudget) {
        fontSizePx *= originalBudget / layout.totalWidth;
        layout = layoutLine(lineTspans, fontSizePx, metrics.bold);
      }

      for (const { tspan, x } of layout.positions) {
        tspan.setAttribute("x", String(x));

        // Style EN LIGNE, pas l'attribut `font-size` seul : une règle
        // de <style> (celle qui fixait la taille d'origine) l'emporte
        // sur un attribut de présentation, mais jamais sur un style en
        // ligne — seul moyen fiable de réduire la taille juste pour
        // cette ligne sans toucher aux autres lignes du même texte.
        if (fontSizePx !== metrics.fontSizePx) {
          tspan.setAttribute("style", `font-size: ${fontSizePx}px`);
        }
      }
    }
  }
};

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

const formatDate = (date) =>
  date
    ? date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";

const injectRectoFields = async (document, member) => {
  const fullName = [
    toTitleCase(member.firstName ?? ""),
    member.lastName ? member.lastName.toUpperCase() : "",
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
  setElementText(
    requireElementById(document, "field-role", "recto.svg"),
    (member.role ?? "membre").toUpperCase()
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
