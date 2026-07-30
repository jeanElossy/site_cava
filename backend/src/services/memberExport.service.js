import { fileURLToPath } from "node:url";
import path from "node:path";

import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

import Member from "../models/Member.js";
import {
  formatRegistrationNumber,
  parseRegistrationNumber,
} from "./registrationNumber.service.js";

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

const fetchMembers = async (filter = {}) => {
  const criteria = {};

  if (filter.church) criteria.church = Number(filter.church);
  if (filter.flock) criteria.flock = filter.flock;
  if (filter.status) criteria.status = filter.status;

  const members = await Member.find(criteria)
    .populate("flock", "name code")
    .lean();

  return members.sort(compareByRegistrationOrder);
};

// Ordre chronologique réel d'inscription (numéro de séquence dans le
// matricule), PAS l'ordre alphabétique du matricule complet — même
// logique que `compareByRegistrationOrder` côté frontend
// (`src/utils/registrationNumber.js`), dupliquée ici faute de code
// partagé entre le site et l'API dans ce dépôt. Les membres sans
// matricule sont placés à la fin, triés par nom entre eux.
const compareByRegistrationOrder = (a, b) => {
  const parsedA = parseRegistrationNumber(a.registrationNumber);
  const parsedB = parseRegistrationNumber(b.registrationNumber);

  if (parsedA && parsedB) {
    if (parsedA.church !== parsedB.church) {
      return parsedA.church - parsedB.church;
    }

    return parsedA.number - parsedB.number;
  }

  if (parsedA) return -1;
  if (parsedB) return 1;

  return `${a.lastName} ${a.firstName}`.localeCompare(
    `${b.lastName} ${b.firstName}`
  );
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
    sheet.addRow({
      registrationNumber: member.registrationNumber
        ? formatRegistrationNumber(member.registrationNumber)
        : "—",
      lastName: displayLastName(member),
      firstName: displayFirstName(member),
      church: member.church ?? "—",
      flock: member.flock?.name ?? "—",
      phone: member.phone ?? "—",
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
