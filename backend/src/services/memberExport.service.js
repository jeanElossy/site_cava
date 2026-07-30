import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

import Member from "../models/Member.js";
import { formatRegistrationNumber } from "./registrationNumber.service.js";

const STATUS_LABELS = { actif: "Actif", inactif: "Inactif" };

const GREEN = "#0d5b3e";
const INK = "#1f2a25";

const fetchMembers = async (filter = {}) => {
  const criteria = {};

  if (filter.church) criteria.church = Number(filter.church);
  if (filter.flock) criteria.flock = filter.flock;
  if (filter.status) criteria.status = filter.status;

  return Member.find(criteria)
    .populate("flock", "name code")
    .sort({ church: 1, lastName: 1, firstName: 1 })
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
    sheet.addRow({
      registrationNumber: member.registrationNumber
        ? formatRegistrationNumber(member.registrationNumber)
        : "—",
      lastName: member.lastName,
      firstName: member.firstName,
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
        `${member.lastName} ${member.firstName}`.trim(),
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
