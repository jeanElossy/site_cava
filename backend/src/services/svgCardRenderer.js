// Outillage partagé de rendu de gabarits SVG Illustrator → PNG/PDF,
// utilisé par memberCardSvg.service.js (carte de membre) et
// guestBadgeSvg.service.js (badges invités). Extrait ici pour que les
// deux pipelines partagent EXACTEMENT la même logique de substitution
// de police et de réajustement de texte, déjà débogée en profondeur
// (voir les commentaires de chaque fonction) — dupliquer ce code
// aurait fini par diverger silencieusement entre les deux.
//
// Principe commun aux deux appelants : ce module ne fait QUE remplacer
// le contenu texte ou la source image d'éléments désignés par leur
// `id` (`field-*`). Il ne crée, ne déplace, ne redimensionne et ne
// recolore jamais rien — toute modification du design se fait dans
// Illustrator, jamais ici.

import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync, existsSync } from "node:fs";

import { DOMParser } from "linkedom";
import { Resvg } from "@resvg/resvg-js";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";

// Résolution de rasterisation. Les gabarits sont en points : x8 donne
// un rendu net à l'impression sans imposer un poids de fichier
// disproportionné.
export const RASTER_SCALE = 8;

// ------------------------------------------------------------------
// Polices — SUBSTITUTION VALIDÉE, seule exception au principe "jamais
// toucher au design".
//
// Les gabarits Illustrator déclarent des polices commerciales
// (Acumin Variable Concept, sous licence Adobe), des polices système
// non redistribuables (Impact) ou explicitement "PERSONAL USE"
// (Byliner Script), qu'on n'a pas le droit d'embarquer sur le
// serveur. On les remplace par Poppins (Regular/Bold/Italic/Bold
// Italic), sous licence SIL OFL — seule la police change, jamais la
// taille, la couleur, l'espacement ou la position du texte.
//
// Règle de correspondance : tout nom de police contenant
// "bold"/"black"/"medium" (insensible à la casse, "Semibold" y compris)
// devient Poppins Bold, le reste devient Poppins Regular — évite une
// table de correspondance figée par nom exact de police, qui se
// périmerait au moindre nouvel export Illustrator. Le style
// (`font-style: italic`, laissé tel quel par cette réécriture) est
// résolu séparément par resvg via les 4 fichiers enregistrés sous le
// même nom de famille.
const FONTS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../assets/fonts"
);
const POPPINS_REGULAR_PATH = path.join(FONTS_DIR, "Poppins-Regular.ttf");
const POPPINS_BOLD_PATH = path.join(FONTS_DIR, "Poppins-Bold.ttf");
const POPPINS_ITALIC_PATH = path.join(FONTS_DIR, "Poppins-Italic.ttf");
const POPPINS_BOLD_ITALIC_PATH = path.join(FONTS_DIR, "Poppins-BoldItalic.ttf");
const CARD_FONT_FAMILY = "Poppins";

export const RESVG_FONT_OPTIONS = {
  fontFiles: [
    POPPINS_REGULAR_PATH,
    POPPINS_BOLD_PATH,
    POPPINS_ITALIC_PATH,
    POPPINS_BOLD_ITALIC_PATH,
  ],
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

export const rewriteFontFamilies = (svgSource) =>
  svgSource.replace(/font-family:\s*([^;]+);/g, (match, families) => {
    const weight = /bold|black|medium/i.test(families) ? 700 : 400;

    return `font-family: ${CARD_FONT_FAMILY}; font-weight: ${weight};`;
  });

const IMAGE_MIME_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export const toDataUri = (buffer, mime) =>
  `data:${mime};base64,${buffer.toString("base64")}`;

// SUBSTITUTION TECHNIQUE VALIDÉE (même principe que les polices
// ci-dessus) : un export Illustrator peut référencer une image bitmap
// statique par son simple nom de fichier (ex.
// xlink:href="signature-pasteur.png"), en s'attendant à ce qu'elle
// soit déposée à côté du SVG au moment de l'impression — mais cette
// version de resvg-js n'a aucune option "dossier de ressources" pour
// résoudre un chemin relatif de ce type au rendu. On l'intègre donc
// en base64 avant rasterisation, exactement comme une photo ou un QR
// code, à partir du dossier fourni par l'appelant (seule convention
// attendue : un simple nom de fichier, jamais un chemin). Aucune
// image déplacée ni modifiée ; une référence introuvable est laissée
// telle quelle plutôt que de faire échouer tout le rendu.
export const inlineLocalImageHrefs = (svgSource, imagesDir) =>
  svgSource.replace(
    /(xlink:href|href)="([^"/:]+\.(?:png|jpe?g))"/g,
    (match, attr, fileName) => {
      const mimeType = IMAGE_MIME_TYPES[path.extname(fileName).toLowerCase()];
      const filePath = path.join(imagesDir, fileName);

      if (!mimeType || !existsSync(filePath)) return match;

      return `${attr}="${toDataUri(readFileSync(filePath), mimeType)}"`;
    }
  );

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
// sur les textes décoratifs que le code ne modifie jamais autrement.
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
// Un même <text> peut porter plusieurs LIGNES, chaque nouvelle ligne
// repérable à un `y` de tspan différent du précédent — regroupées ici
// pour être traitées indépendamment (voir reflowMultiTspanText).
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
  let previousIsSingleChar = false;

  for (const tspan of lineTspans) {
    const originalX = parseFloat(tspan.getAttribute("x") ?? "0");

    if (cursorX === null) {
      cursorX = originalX;
    } else if (previousIsSingleChar) {
      // Le tspan précédent est un caractère ISOLÉ (une seule lettre) :
      // l'écart d'origine (`originalGap`) peut refléter un espacement
      // délibérément généreux plutôt qu'un simple kerning fin — ex. la
      // lettre "Ç" du logo CAVA dans sa pastille colorée, suivie du mot
      // "entre" bien plus loin que sa seule largeur de glyphe. On
      // n'avance donc jamais MOINS que cet écart pour ce cas précis.
      const originalGap = originalX - previousOriginalX;

      cursorX += Math.max(previousMeasuredWidth, originalGap);
    } else {
      // Tspan précédent multi-caractères (un mot ou un groupe) : son
      // `originalGap` n'est qu'un artefact de la largeur de la police
      // D'ORIGINE (souvent plus large que Poppins), pas un espacement
      // voulu — le prendre comme plancher ici étire visiblement le
      // texte (ex. "JUSQU'AU" avec un grand vide avant l'apostrophe).
      // Seule la largeur RÉELLEMENT mesurée avance le curseur.
      cursorX += previousMeasuredWidth;
    }

    const measuredWidth = textMeasureContext.measureText(
      tspan.textContent
    ).width;

    positions.push({ tspan, x: cursorX, width: measuredWidth });

    previousOriginalX = originalX;
    previousMeasuredWidth = measuredWidth;
    previousIsSingleChar = tspan.textContent.trim().length <= 1;
  }

  const first = positions[0];
  const last = positions[positions.length - 1];

  return { positions, totalWidth: last.x + last.width - first.x };
};

export const reflowMultiTspanText = (document, svgSource) => {
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
      // de son empan d'origine — un problème d'ampleur globale que
      // l'espacement au cas par cas ci-dessus ne peut pas résoudre.
      // `originalBudget` réutilise la même mesure (police de
      // substitution, même taille) pour son dernier caractère : une
      // comparaison à mesure égale, jamais une estimation de la police
      // d'origine que nous n'avons pas le droit d'embarquer.
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

// Analyse en mode XML strict (`image/svg+xml`), PAS `parseHTML` : un
// parseur HTML applique les règles d'insertion "contenu étranger" du
// HTML5 pour le SVG imbriqué, incomplètes dans linkedom pour certains
// éléments peu courants — les primitives de filtre (`feComposite`
// notamment, utilisées par des ombres portées) disparaissaient
// silencieusement au moment de resérialiser le document, invalidant le
// filtre et rendant TOUT l'élément qui le référence invisible
// (comportement du spec SVG pour une référence de filtre brisée). Le
// mode XML strict préserve fidèlement l'intégralité du document, y
// compris ces éléments.
export const parseSvgDocument = (svgSource) => {
  const parser = new DOMParser();

  return parser.parseFromString(svgSource, "image/svg+xml");
};

export const serializeSvg = (document) => {
  const svgElement = document.documentElement;

  if (!svgElement || svgElement.tagName?.toLowerCase() !== "svg") {
    throw new Error("Gabarit de carte invalide : aucun élément <svg> trouvé.");
  }

  return svgElement.outerHTML;
};

export const requireElementById = (document, id, templateName) => {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(
      `Gabarit "${templateName}" incomplet : aucun élément avec id="${id}" — ` +
        "voir le contrat d'id documenté en tête du service appelant."
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
export const setElementText = (element, value) => {
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
// une photo/un QR, seulement la FORME qui délimite leur zone (un
// <rect> arrondi servant de cadre). Dans ce cas, une <image> est
// insérée juste après ce cadre, aux mêmes x/y/largeur/hauteur/rayon
// d'angle : le cadre existant (son remplissage et son contour, définis
// dans Illustrator) reste affiché tel quel, l'image vient seulement
// combler l'intérieur — rien n'est déplacé ni redimensionné, la
// géométrie vient entièrement du gabarit lui-même.
export const setElementImageSource = (element, dataUri) => {
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
      "ni une <image> ni un <rect> — impossible d'y injecter une image."
  );
};

export const rasterizeSvgToPng = (svgSource) => {
  const resvg = new Resvg(svgSource, {
    fitTo: { mode: "zoom", value: RASTER_SCALE },
    font: RESVG_FONT_OPTIONS,
  });

  return resvg.render().asPng();
};
