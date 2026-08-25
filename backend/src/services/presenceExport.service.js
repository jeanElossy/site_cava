import { fileURLToPath } from "node:url";
import path from "node:path";

import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

import Attendance from "../models/Attendance.js";
import PresenceSecurityQr from "../models/PresenceSecurityQr.js";
import { ApiError } from "../utils/ApiError.js";
import { excelSafeCell } from "../utils/excelSafeCell.js";
import { getEffectiveWindow } from "../utils/presenceQrWindow.js";
import { drawCenteredImage } from "../utils/pdfLogo.js";
import { formatRegistrationNumber } from "../utils/registrationFormat.js";

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

// Formate la fenêtre de validité EFFECTIVE (activation + durée — voir
// utils/presenceQrWindow.js), avec un repli explicite pour un QR
// encore "en attente" : sans ça, `.toLocaleString()` sur un `validFrom`
// nul ferait planter l'export au lieu d'un message clair.
// `separator` : la flèche « → » n'existe pas dans la police par défaut
// de PDFKit (Helvetica, jeu WinAnsi), où elle s'imprimait en caractères
// parasites. Le PDF passe donc « à » ; le XLSX, lui, garde la flèche —
// un tableur n'a pas cette limite.
const formatWindow = (qr, { separator = "→" } = {}) => {
  const { validFrom, validUntil } = getEffectiveWindow(qr);

  if (!validFrom) return "QR jamais activé — aucune présence possible.";

  return `${validFrom.toLocaleString("fr-FR")} ${separator} ${validUntil.toLocaleString("fr-FR")}`;
};

const fetchAttendanceReport = async (securityQrId) => {
  const qr = await PresenceSecurityQr.findById(securityQrId).lean();

  if (!qr) throw ApiError.notFound("QR de sécurité introuvable.");

  const records = await Attendance.find({ securityQr: securityQrId })
    .sort({ recordedAt: 1 })
    .populate("member", "firstName lastName registrationNumber phone area gender")
    .populate("agent", "firstName lastName registrationNumber")
    .lean();

  const members = records.filter((record) => record.kind === "member");
  const visitors = records.filter((record) => record.kind === "visitor");

  return { qr, records, members, visitors };
};

// Genre d'une présence, membre ou visiteur — `Member.gender` pour un
// membre, `visitor.gender` pour un visiteur (posé au badgeage ou au
// scan d'un badge invité, voir presence.service.js). Peut être absent
// pour une présence antérieure à l'introduction de ce champ ; ces
// présences comptent dans le total général mais pas dans la répartition
// femme/homme, plutôt que de fausser l'un des deux totaux au hasard.
const genderOf = (record) =>
  record.kind === "member" ? record.member?.gender : record.visitor?.gender;

const countByGender = (records) => ({
  women: records.filter((record) => genderOf(record) === "femme").length,
  men: records.filter((record) => genderOf(record) === "homme").length,
});

const displayName = (record) =>
  record.kind === "member"
    ? `${record.member?.lastName ?? "—"} ${record.member?.firstName ?? ""}`.trim()
    : `${record.visitor?.lastName ?? "—"} ${record.visitor?.firstName ?? ""}`.trim();

export const buildAttendanceXlsx = async (securityQrId) => {
  const { qr, records, members, visitors } = await fetchAttendanceReport(securityQrId);
  const { women, men } = countByGender(records);

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
      value: formatWindow(qr),
    },
    { label: "Total général", value: records.length },
    { label: "Dont membres", value: members.length },
    { label: "Dont visiteurs", value: visitors.length },
    { label: "Dont femmes", value: women },
    { label: "Dont hommes", value: men },
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

    // `excelSafeCell` neutralise l'injection de formule Excel/CSV sur
    // tout champ texte libre saisi par un tiers non administrateur :
    // nom/prénom/téléphone/quartier d'un membre (formulaire public
    // d'inscription) ou d'un visiteur (saisie libre par l'agent au
    // badgeage) — voir utils/excelSafeCell.js.
    sheet.addRow({
      lastName: excelSafeCell(
        isMember ? record.member?.lastName ?? "—" : record.visitor?.lastName ?? "—"
      ),
      firstName: excelSafeCell(
        isMember ? record.member?.firstName ?? "—" : record.visitor?.firstName ?? "—"
      ),
      kind: isMember ? "Membre" : "Visiteur",
      registrationNumber: isMember ? record.member?.registrationNumber ?? "—" : "—",
      phone: excelSafeCell((isMember ? record.member?.phone : record.visitor?.phone) ?? "—"),
      area: excelSafeCell(isMember ? record.member?.area ?? "—" : "—"),
      recordedAt: new Date(record.recordedAt).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      method: record.method === "scan" ? "Scan" : "Manuel",
      agent: excelSafeCell(
        record.agent
          ? `${record.agent.firstName} ${record.agent.lastName}`.trim()
          : "—"
      ),
    });
  }

  return workbook.xlsx.writeBuffer();
};

// Un badge invité pré-imprimé porte une identité fictive ("Invité
// Homme 1", voir presence.service.js#recordGuestBadgeAttendance)
// destinée au seul comptage : le même invité est ensuite, le plus
// souvent, ré-enregistré à la main sous son vrai nom. Lister les deux
// ferait apparaître deux lignes pour la même personne dans le
// tableau nominatif — voir buildVisitorsPdf, même principe.
const isGuestBadgePlaceholder = (record) =>
  record.kind === "visitor" && Boolean(record.visitor?.badgeCode);

export const buildAttendancePdf = async (securityQrId) => {
  const { qr, records, members, visitors } = await fetchAttendanceReport(securityQrId);
  const { women, men } = countByGender(records);

  // Les totaux ci-dessus restent basés sur TOUS les enregistrements
  // (badges compris, pour ne pas perdre le décompte de ceux jamais
  // ré-enregistrés à la main) — seul le tableau nominatif exclut les
  // badges invités, dont l'identité est fictive.
  const listedRecords = records.filter((record) => !isGuestBadgePlaceholder(record));

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawCenteredImage(doc, LOGO_PATH, 64);
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
      .text(formatWindow(qr, { separator: "à" }), { align: "center" })
      .moveDown(0.5);

    doc
      .fontSize(10)
      .fillColor(INK)
      .text(
        `Total général : ${records.length}   —   Membres : ${members.length}   —   Visiteurs : ${visitors.length}`,
        { align: "center" }
      )
      .text(`Femmes : ${women}   —   Hommes : ${men}`, { align: "center" })
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

    listedRecords.forEach((record, index) => {
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
        record.kind === "member"
          ? formatRegistrationNumber(record.member?.registrationNumber) || "—"
          : "—",
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
