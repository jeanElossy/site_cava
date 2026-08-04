import { fileURLToPath } from "node:url";
import path from "node:path";

import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

import Attendance from "../models/Attendance.js";
import PresenceSecurityQr from "../models/PresenceSecurityQr.js";
import { ApiError } from "../utils/ApiError.js";

// Export de la liste des présences d'un service, avec le décompte
// membres/visiteurs — voir docs/superpowers/specs/2026-08-04-badgeage-
// presences-design.md. Deux formats, même source de données : Excel
// pour retravailler la liste (tri, filtre), PDF pour l'imprimer ou
// l'archiver tel quel — même principe que memberExport.service.js
// pour le registre des membres.

const GREEN = "#0d5b3e";
const INK = "#1f2a25";

// Même logo que le registre des membres (pdfkit ne lit que PNG/JPEG,
// pas le .gif du site public).
const LOGO_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../assets/logo-cava.png"
);

const fetchAttendanceReport = async (securityQrId) => {
  const qr = await PresenceSecurityQr.findById(securityQrId).lean();

  if (!qr) throw ApiError.notFound("QR de sécurité introuvable.");

  const records = await Attendance.find({ securityQr: securityQrId })
    .sort({ recordedAt: 1 })
    .populate("member", "firstName lastName registrationNumber phone area")
    .populate("agent", "firstName lastName registrationNumber")
    .lean();

  const members = records.filter((record) => record.kind === "member");
  const visitors = records.filter((record) => record.kind === "visitor");

  return { qr, records, members, visitors };
};

const displayName = (record) =>
  record.kind === "member"
    ? `${record.member?.lastName ?? "—"} ${record.member?.firstName ?? ""}`.trim()
    : `${record.visitor?.lastName ?? "—"} ${record.visitor?.firstName ?? ""}`.trim();

export const buildAttendanceXlsx = async (securityQrId) => {
  const { qr, records, members, visitors } = await fetchAttendanceReport(securityQrId);

  const workbook = new ExcelJS.Workbook();

  // Deux feuilles plutôt qu'une seule mêlant total et détail :
  // `Résumé` reste lisible même imprimée seule, `Présences` garde une
  // ligne d'en-tête propre pour le tri/filtre Excel.
  const summary = workbook.addWorksheet("Résumé");

  summary.columns = [
    { key: "label", width: 28 },
    { key: "value", width: 40 },
  ];

  summary.addRows([
    { label: "Service", value: qr.label },
    {
      label: "Fenêtre de validité",
      value: `${qr.validFrom.toLocaleString("fr-FR")} → ${qr.validUntil.toLocaleString("fr-FR")}`,
    },
    { label: "Total présents", value: records.length },
    { label: "Dont membres", value: members.length },
    { label: "Dont visiteurs", value: visitors.length },
  ]);

  summary.getColumn("label").font = { bold: true };

  const sheet = workbook.addWorksheet("Présences");

  sheet.columns = [
    { header: "Nom", key: "lastName", width: 22 },
    { header: "Prénom", key: "firstName", width: 22 },
    { header: "Type", key: "kind", width: 14 },
    { header: "Matricule", key: "registrationNumber", width: 18 },
    { header: "Téléphone", key: "phone", width: 18 },
    { header: "Quartier", key: "area", width: 20 },
    { header: "Heure", key: "recordedAt", width: 12 },
    { header: "Méthode", key: "method", width: 12 },
    { header: "Agent", key: "agent", width: 24 },
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.autoFilter = { from: "A1", to: "I1" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (const record of records) {
    const isMember = record.kind === "member";

    sheet.addRow({
      lastName: isMember ? record.member?.lastName ?? "—" : record.visitor?.lastName ?? "—",
      firstName: isMember ? record.member?.firstName ?? "—" : record.visitor?.firstName ?? "—",
      kind: isMember ? "Membre" : "Visiteur",
      registrationNumber: isMember ? record.member?.registrationNumber ?? "—" : "—",
      phone: (isMember ? record.member?.phone : record.visitor?.phone) ?? "—",
      area: isMember ? record.member?.area ?? "—" : "—",
      recordedAt: new Date(record.recordedAt).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      method: record.method === "scan" ? "Scan" : "Manuel",
      agent: record.agent
        ? `${record.agent.firstName} ${record.agent.lastName}`.trim()
        : "—",
    });
  }

  return workbook.xlsx.writeBuffer();
};

export const buildAttendancePdf = async (securityQrId) => {
  const { qr, records, members, visitors } = await fetchAttendanceReport(securityQrId);

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
      .text(qr.label, { align: "center" })
      .fontSize(9)
      .fillColor(GREEN)
      .text(
        `${qr.validFrom.toLocaleString("fr-FR")} → ${qr.validUntil.toLocaleString("fr-FR")}`,
        { align: "center" }
      )
      .moveDown(0.6);

    doc
      .fontSize(10)
      .fillColor(INK)
      .text(
        `Total présents : ${records.length}   —   Membres : ${members.length}   —   Visiteurs : ${visitors.length}`,
        { align: "center" }
      )
      .moveDown(1);

    const columns = [
      { label: "N°", width: 30 },
      { label: "Nom & prénoms", width: 190 },
      { label: "Type", width: 60 },
      { label: "Matricule", width: 90 },
      { label: "Heure", width: 60 },
      { label: "Agent", width: 90 },
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

    records.forEach((record, index) => {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage();
        drawHeader();
      }

      let x = doc.page.margins.left;
      const y = doc.y;
      const row = [
        String(index + 1).padStart(3, "0"),
        displayName(record),
        record.kind === "member" ? "Membre" : "Visiteur",
        record.kind === "member" ? record.member?.registrationNumber ?? "—" : "—",
        new Date(record.recordedAt).toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        record.agent
          ? `${record.agent.firstName} ${record.agent.lastName}`.trim()
          : "—",
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
