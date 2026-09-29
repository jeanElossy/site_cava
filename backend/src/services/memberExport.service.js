import { fileURLToPath } from "node:url";
import path from "node:path";

import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

import Member from "../models/Member.js";
import { formatRegistrationNumber } from "./registrationNumber.service.js";
import {
  missingProfileLabels,
  profileCompletion,
  TOTAL_PROFILE_FIELDS,
} from "./memberProfileAudit.service.js";
import { excelSafeCell } from "../utils/excelSafeCell.js";

const STATUS_LABELS = { actif: "Actif", inactif: "Inactif" };

const GREEN = "#0d5b3e";
const INK = "#1f2a25";

// pdfkit ne lit que PNG/JPEG (pas le .gif utilisé côté site public) —
// copié une fois dans le backend plutôt que lu depuis `public/` du
// frontend, un dossier qui n'existe pas forcément dans le déploiement
// du backend (services séparés sur Render).
const LOGO_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../assets/logo-cava.png"
);

// Même normalisation d'affichage que la table Membres de l'admin
// (`src/pages/admin/CommunityAdmin.jsx`, `toTitleCase`) : un membre
// saisit son nom dans la casse qui lui vient, les exports ne doivent
// pas reproduire un mélange majuscules/minuscules incohérent d'une
// ligne à l'autre. Dupliqué faute de code partagé entre le site et
// l'API dans ce dépôt.
const toTitleCase = (value = "") =>
  value
    .toLowerCase()
    .replace(/(^|[\s-])\p{L}/gu, (match) => match.toUpperCase());

const displayFirstName = (member) =>
  member.firstName ? toTitleCase(member.firstName) : "";

const displayLastName = (member) =>
  member.lastName ? member.lastName.toUpperCase() : "";

// Un membre désactivé (ne fréquente plus régulièrement — voir
// `Member.status`) ne doit JAMAIS apparaître dans le registre exporté :
// c'est le document remis ou archivé comme liste officielle des
// membres, pas un export de travail. `status` n'est donc pas un filtre
// que l'appelant peut assouplir — il est toujours forcé à "actif",
// quoi que `filter` contienne.
const fetchMembers = async (filter = {}) => {
  const criteria = { status: "actif" };

  if (filter.church) criteria.church = Number(filter.church);
  if (filter.flock) criteria.flock = filter.flock;

  // Ordre chronologique réel d'inscription, trié PAR MONGO sur
  // `registrationOrder` (le rang extrait du matricule — voir
  // Member.js). Un tri alphabétique sur le matricule complet
  // classerait d'abord par code de bergerie et mélangerait les rangs.
  //
  // Ce module portait sa propre copie du comparateur, en JavaScript ;
  // elle a disparu avec l'ajout du champ dérivé, qui donne le même
  // ordre à l'export, à l'annuaire d'administration et à l'API — au
  // lieu de trois implémentations à garder synchronisées. Les membres
  // sans matricule gardent leur place en fin de liste
  // (`registrationOrder` vaut alors UNRANKED), départagés par nom.
  return Member.find(criteria)
    .populate("flock", "name code")
    .sort({ church: 1, registrationOrder: 1, lastName: 1, firstName: 1 })
    .lean();
};

export const buildMembersXlsx = async (filter = {}) => {
  const members = await fetchMembers(filter);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Membres");

  sheet.columns = [
    { header: "Matricule", key: "registrationNumber", width: 18 },
    { header: "Nom", key: "lastName", width: 20 },
    { header: "Prénom", key: "firstName", width: 20 },
    { header: "Église", key: "church", width: 10 },
    { header: "Bergerie", key: "flock", width: 20 },
    { header: "Téléphone", key: "phone", width: 18 },
    { header: "Statut", key: "status", width: 12 },
    { header: "Date d'arrivée", key: "joinedAt", width: 16 },
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.autoFilter = { from: "A1", to: "H1" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (const member of members) {
    // `excelSafeCell` neutralise l'injection de formule Excel/CSV sur
    // les champs texte libre saisis par le formulaire public
    // d'inscription (nom, prénom, téléphone) — voir
    // utils/excelSafeCell.js.
    sheet.addRow({
      registrationNumber: member.registrationNumber
        ? formatRegistrationNumber(member.registrationNumber)
        : "—",
      lastName: excelSafeCell(displayLastName(member)),
      firstName: excelSafeCell(displayFirstName(member)),
      church: member.church ?? "—",
      flock: excelSafeCell(member.flock?.name ?? "—"),
      phone: excelSafeCell(member.phone ?? "—"),
      status: STATUS_LABELS[member.status] ?? member.status,
      joinedAt: member.joinedAt
        ? new Date(member.joinedAt).toLocaleDateString("fr-FR")
        : "—",
    });
  }

  return workbook.xlsx.writeBuffer();
};

export const buildMembersPdf = async (filter = {}) => {
  const members = await fetchMembers(filter);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.image(LOGO_PATH, { width: 64, align: "center" });
    doc.moveDown(0.4);

    doc
      .fontSize(16)
      .fillColor(GREEN)
      .text("Centre Apostolique Vie et Abondance", { align: "center" });

    doc
      .fontSize(12)
      .fillColor(INK)
      .text("Registre des membres", { align: "center" })
      .moveDown(1);

    const columns = [
      { label: "N°", width: 30 },
      { label: "Matricule", width: 100 },
      { label: "Nom & prénoms", width: 220 },
      { label: "Bergerie", width: 120 },
    ];

    const drawHeader = () => {
      let x = doc.page.margins.left;
      const y = doc.y;

      doc.fontSize(9).fillColor(GREEN);

      for (const column of columns) {
        doc.text(column.label, x, y, { width: column.width });
        x += column.width;
      }

      doc.moveDown(0.5);
      doc.fillColor(INK);
    };

    drawHeader();

    members.forEach((member, index) => {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage();
        drawHeader();
      }

      let x = doc.page.margins.left;
      const y = doc.y;
      const row = [
        String(index + 1).padStart(3, "0"),
        member.registrationNumber
          ? formatRegistrationNumber(member.registrationNumber)
          : "—",
        `${displayLastName(member)} ${displayFirstName(member)}`.trim(),
        member.flock?.name ?? "—",
      ];

      columns.forEach((column, columnIndex) => {
        doc.fontSize(9).text(row[columnIndex], x, y, { width: column.width });
        x += column.width;
      });

      doc.moveDown(0.3);
    });

    doc.end();
  });
};

// ---------------------------------------------------------------------
// Documents de travail : relance des fiches incomplètes, et annuaire
// des compétences.
//
// Ces deux PDF ne sont PAS le registre officiel ci-dessus : ce sont des
// listes de travail, imprimées pour être annotées au stylo. D'où le
// format paysage et la petite police pour le premier (une colonne
// entière de champs manquants à faire tenir), et les totaux en pied de
// document — on veut savoir tout de suite combien de fiches il reste à
// compléter.
// ---------------------------------------------------------------------

const MUTED = "#6b7a72";
const ZEBRA = "#f2f7f4";

const PAGE_MARGIN = 36;

const displayFullName = (member) =>
  `${displayLastName(member)} ${displayFirstName(member)}`.trim() || "—";

// pdfkit n'a pas de tableau : cette fabrique en tient lieu. Elle rend
// une ligne à hauteur VARIABLE — la colonne « champs non renseignés »
// peut occuper trois lignes quand la suivante en tient une seule, et
// une hauteur fixe tronquerait silencieusement le texte qui fait tout
// l'intérêt du document.
const createTableRenderer = (doc, columns, { fontSize = 8 } = {}) => {
  const left = doc.page.margins.left;
  const bottom = () => doc.page.height - doc.page.margins.bottom - 24;

  const xOf = (index) =>
    left + columns.slice(0, index).reduce((sum, column) => sum + column.width, 0);

  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);

  const drawHeader = () => {
    const y = doc.y;

    doc.font("Helvetica-Bold").fontSize(fontSize).fillColor(GREEN);

    columns.forEach((column, index) => {
      doc.text(column.label, xOf(index) + 2, y, {
        width: column.width - 4,
        lineBreak: false,
        ellipsis: true,
      });
    });

    const ruleY = y + fontSize + 3;

    doc
      .moveTo(left, ruleY)
      .lineTo(left + totalWidth, ruleY)
      .lineWidth(0.8)
      .strokeColor(GREEN)
      .stroke();

    doc.font("Helvetica").fillColor(INK);
    doc.y = ruleY + 4;
  };

  // `values` : un texte par colonne, dans l'ordre de `columns`.
  const drawRow = (values, { index = 0 } = {}) => {
    doc.font("Helvetica").fontSize(fontSize);

    // Hauteur réelle de la ligne = la plus haute de ses cellules, donc
    // mesurée AVANT d'écrire quoi que ce soit : une fois la première
    // cellule écrite, `doc.y` a déjà bougé.
    const height =
      Math.max(
        ...columns.map((column, columnIndex) =>
          doc.heightOfString(values[columnIndex] ?? "—", {
            width: column.width - 4,
          })
        )
      ) + 4;

    if (doc.y + height > bottom()) {
      doc.addPage();
      drawHeader();
    }

    const y = doc.y;

    // Alternance de fond : sur une ligne haute de trois lignes de
    // texte, l'œil perd sinon la correspondance entre le matricule à
    // gauche et les champs manquants à droite.
    if (index % 2 === 1) {
      doc
        .rect(left, y - 2, totalWidth, height)
        .fillColor(ZEBRA)
        .fill();
    }

    doc.fillColor(INK);

    columns.forEach((column, columnIndex) => {
      doc.text(values[columnIndex] ?? "—", xOf(columnIndex) + 2, y, {
        width: column.width - 4,
      });
    });

    doc.y = y + height;
  };

  return { drawHeader, drawRow };
};

const drawDocumentHeader = (doc, { title, subtitle, note }) => {
  doc.image(LOGO_PATH, doc.page.margins.left, doc.y, { width: 46 });

  const textLeft = doc.page.margins.left + 58;
  const textWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right - 58;

  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(GREEN)
    .text("Centre Apostolique Vie et Abondance", textLeft, doc.y + 2, {
      width: textWidth,
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(INK)
    .text(title, { width: textWidth });

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(MUTED)
    .text(subtitle, { width: textWidth });

  doc.y = Math.max(doc.y, doc.page.margins.top + 50);
  doc.moveDown(0.6);

  if (note) {
    doc
      .font("Helvetica-Oblique")
      .fontSize(7.5)
      .fillColor(MUTED)
      .text(note, doc.page.margins.left, doc.y, {
        width:
          doc.page.width - doc.page.margins.left - doc.page.margins.right,
      });

    doc.moveDown(0.6);
  }

  doc.font("Helvetica").fillColor(INK);
};

// Pied de page numéroté, écrit APRÈS coup sur chaque page tamponnée
// (`bufferPages: true`) : le nombre total de pages n'est connu qu'une
// fois le tableau entièrement rendu.
const stampFooters = (doc, label) => {
  const range = doc.bufferedPageRange();

  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index);

    const y = doc.page.height - doc.page.margins.bottom + 6;

    // Le pied de page s'écrit SOUS la marge basse : pdfkit y voit un
    // dépassement et ouvre une page de plus — d'où une page blanche
    // finale, portant pour seul contenu le pied qu'on venait
    // d'écrire. Annuler la marge le temps du tampon supprime le
    // déclencheur ; elle est rétablie juste après, la page suivante en
    // a besoin.
    const bottomMargin = doc.page.margins.bottom;

    doc.page.margins.bottom = 0;

    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(MUTED)
      .text(
        `${label} — page ${index + 1}/${range.count}`,
        doc.page.margins.left,
        y,
        {
          width:
            doc.page.width - doc.page.margins.left - doc.page.margins.right,
          align: "center",
          lineBreak: false,
        }
      );

    doc.page.margins.bottom = bottomMargin;
  }
};

// Branche la collecte du flux et renvoie la promesse du buffer — SANS
// clore le document : l'appelant dessine d'abord, puis appelle
// `doc.end()`. Un `end()` posé ici s'exécuterait à l'abonnement, donc
// avant le moindre trait, et rendrait un PDF vide de ~1 Ko.
const collectPdf = (doc) =>
  new Promise((resolve, reject) => {
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

const formattedRegistrationNumber = (member) =>
  member.registrationNumber
    ? formatRegistrationNumber(member.registrationNumber)
    : "— (sans matricule)";

const today = () => new Date().toLocaleDateString("fr-FR");

// Liste de relance : les membres actifs dont la fiche n'est pas
// complète, avec le détail de ce qui manque chez chacun.
//
// Triée par fiche LA PLUS VIDE d'abord (et non par matricule comme le
// registre) : l'ordre du registre est celui de la lecture, celui-ci est
// un ordre de travail — on commence par les fiches où un seul appel
// rapporte le plus d'informations.
export const buildIncompleteProfilesPdf = async (filter = {}) => {
  const members = await fetchMembers(filter);

  const rows = members
    .map((member) => ({
      member,
      missing: missingProfileLabels(member),
      completion: profileCompletion(member),
    }))
    .filter((row) => row.missing.length > 0)
    .sort(
      (a, b) =>
        b.missing.length - a.missing.length ||
        a.member.church - b.member.church ||
        a.member.registrationOrder - b.member.registrationOrder
    );

  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: PAGE_MARGIN,
    bufferPages: true,
  });

  const pdf = collectPdf(doc);

  drawDocumentHeader(doc, {
    title: "Fiches membres à compléter — liste de relance",
    subtitle: `${rows.length} membre(s) actif(s) sur ${members.length} ont une fiche incomplète · Édité le ${today()}`,
    note:
      `Les ${TOTAL_PROFILE_FIELDS} champs suivis sont ceux du formulaire d'inscription (/inscription). ` +
      "L'e-mail et le WhatsApp restent facultatifs : beaucoup de membres n'ont que leur téléphone. " +
      "Les baptêmes ne sont signalés que si aucune des deux cases n'a jamais été touchée. " +
      "Les membres désactivés n'apparaissent pas dans cette liste.",
  });

  const columns = [
    { label: "N°", width: 26 },
    { label: "Matricule", width: 78 },
    { label: "Nom & prénoms", width: 132 },
    // Un numéro ivoirien complet (« +225 01 02 03 04 05 ») passait à la
    // ligne à 74 pt : c'est la colonne qu'on lit en composant, elle
    // doit tenir d'un bloc.
    { label: "Téléphone", width: 88 },
    { label: "Bergerie", width: 76 },
    { label: "Rempli", width: 36 },
    { label: "Champs non renseignés", width: 332 },
  ];

  const table = createTableRenderer(doc, columns);

  table.drawHeader();

  rows.forEach((row, index) => {
    table.drawRow(
      [
        String(index + 1).padStart(3, "0"),
        formattedRegistrationNumber(row.member),
        displayFullName(row.member),
        row.member.phone || "—",
        row.member.flock?.name ?? "—",
        `${row.completion} %`,
        row.missing.join(" · "),
      ],
      { index }
    );
  });

  if (rows.length === 0) {
    doc
      .font("Helvetica-Oblique")
      .fontSize(9)
      .fillColor(MUTED)
      .text("Toutes les fiches de membres actifs sont complètes.", {
        align: "center",
      });
  }

  stampFooters(doc, "Fiches à compléter — CAVA");

  doc.end();

  return pdf;
};

// Annuaire des compétences : TOUS les membres actifs, y compris ceux
// dont la rubrique compétences est vide — c'est justement ce vide qui
// dit où l'appel à candidature doit d'abord recruter. Ordre du
// registre (église puis rang du matricule), pour se relire à côté de
// l'annuaire habituel.
export const buildSkillsDirectoryPdf = async (filter = {}) => {
  const members = await fetchMembers(filter);

  const documented = members.filter(
    (member) => Array.isArray(member.skills) && member.skills.length > 0
  ).length;

  const doc = new PDFDocument({
    size: "A4",
    margin: PAGE_MARGIN,
    bufferPages: true,
  });

  const pdf = collectPdf(doc);

  drawDocumentHeader(doc, {
    title: "Annuaire des compétences des membres",
    subtitle: `${members.length} membre(s) actif(s) · ${documented} avec au moins une compétence déclarée · Édité le ${today()}`,
    note:
      "Les compétences proviennent de la rubrique « Engagement » du formulaire d'inscription, " +
      "déclarée par le membre lui-même. Une case vide signifie « jamais renseignée », pas « aucune compétence ».",
  });

  const columns = [
    { label: "N°", width: 26 },
    { label: "Matricule", width: 78 },
    { label: "Nom & prénoms", width: 132 },
    { label: "Profession", width: 96 },
    { label: "Compétences", width: 191 },
  ];

  const table = createTableRenderer(doc, columns, { fontSize: 8.5 });

  table.drawHeader();

  members.forEach((member, index) => {
    const skills = (member.skills ?? [])
      .map((skill) => String(skill).trim())
      .filter(Boolean);

    table.drawRow(
      [
        String(index + 1).padStart(3, "0"),
        formattedRegistrationNumber(member),
        displayFullName(member),
        member.profession || "—",
        skills.length > 0 ? skills.join(", ") : "— non renseigné",
      ],
      { index }
    );
  });

  stampFooters(doc, "Annuaire des compétences — CAVA");

  doc.end();

  return pdf;
};
