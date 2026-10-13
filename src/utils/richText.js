// Mise en forme légère du texte saisi dans l'administration (annonces).
//
// Les rédacteurs écrivent naturellement en « quasi-Markdown » : `## Titre`,
// `* élément de liste`, `*italique*`, `**gras**`. Affiché tel quel, le texte
// montrait ces marques au visiteur, sans aucun retour à la ligne.
//
// SÉCURITÉ : ces fonctions renvoient des STRUCTURES (blocs, segments), que
// le composant transforme en éléments React. Aucun HTML n'est produit ni
// injecté (`dangerouslySetInnerHTML` est proscrit ici) : un `<script>` saisi
// dans une annonce s'affiche comme du texte, il ne s'exécute jamais.

const HEADING = /^#{1,6}\s+(.*)$/;
const LIST_ITEM = /^[*\-•]\s+(.*)$/;

// Découpe un texte en blocs : titres, listes, paragraphes.
//
// Une ligne vide sépare les paragraphes ; des lignes consécutives sans
// ligne vide forment un seul paragraphe.
export const parseRichText = (text) => {
  if (typeof text !== "string" || text.trim() === "") return [];

  const blocks = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  };

  const flushList = () => {
    if (list) {
      blocks.push({ type: "list", items: list });
      list = null;
    }
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (line === "") {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(HEADING);

    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", text: heading[1].trim() });
      continue;
    }

    // `*texte*` seul sur sa ligne est de l'italique, pas une puce : la
    // puce exige un espace après l'astérisque.
    const item = line.match(LIST_ITEM);

    if (item) {
      flushParagraph();
      list = list ?? [];
      list.push(item[1].trim());
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
};

// Découpe une ligne en segments `{ text, strong, em }` selon `**gras**`
// et `*italique*`. Un astérisque orphelin reste du texte.
export const parseInline = (text) => {
  if (typeof text !== "string" || text === "") return [];

  const segments = [];
  const pattern = /\*\*([^*]+)\*\*|\*([^*\s][^*]*?)\*/g;

  let last = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ text: text.slice(last, match.index) });
    }

    if (match[1] !== undefined) {
      segments.push({ text: match[1], strong: true });
    } else {
      segments.push({ text: match[2], em: true });
    }

    last = pattern.lastIndex;
  }

  if (last < text.length) segments.push({ text: text.slice(last) });

  return segments;
};

// Version texte brut, pour un aperçu tronqué : marques retirées, blocs
// mis bout à bout.
export const toPlainText = (text) =>
  parseRichText(text)
    .flatMap((block) => (block.type === "list" ? block.items : [block.text]))
    .map((line) =>
      parseInline(line)
        .map((segment) => segment.text)
        .join("")
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
