import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import type { Response } from "express";

const BLUE = "#1565C0";
const ORANGE = "#FF6F00";
const DARK = "#0D1B2A";
const MUTED = "#64748B";
const LIGHT = "#F8FAFC";
const BORDER = "#DDE3ED";
const WHITE = "#FFFFFF";
const GREEN = "#2E7D32";
const RED = "#C62828";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;
const HEADER_H = 70;
const FOOTER_H = 26;
const SAFE_BOTTOM = PAGE_H - FOOTER_H - 16;

let _logoBuffer: Buffer | null | undefined = undefined;

function getLogoBuffer(): Buffer | undefined {
  if (_logoBuffer !== undefined) return _logoBuffer ?? undefined;
  const candidates = [
    path.join(process.cwd(), "artifacts/provision-civils/assets/images/logo.jpg"),
    path.join(process.cwd(), "../provision-civils/assets/images/logo.jpg"),
  ];
  for (const p of candidates) {
    try {
      _logoBuffer = fs.readFileSync(p);
      return _logoBuffer;
    } catch {}
  }
  _logoBuffer = null;
  return undefined;
}

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  try {
    const dt =
      typeof d === "string" && d.length === 10
        ? new Date(d + "T00:00:00")
        : new Date(d as string);
    return dt.toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(d);
  }
}

function formatCurrency(v: number | string | null | undefined): string {
  if (v == null) return "—";
  const n = Number(v);
  if (isNaN(n)) return "—";
  return "R " + n.toLocaleString("en-ZA", { minimumFractionDigits: 2 });
}

function b64ToBuffer(uri: string): Buffer | null {
  if (!uri?.startsWith("data:image")) return null;
  const idx = uri.indexOf(",");
  if (idx < 0) return null;
  try {
    return Buffer.from(uri.slice(idx + 1), "base64");
  } catch {
    return null;
  }
}

function drawHeader(doc: PDFKit.PDFDocument, subtitle: string): void {
  const logo = getLogoBuffer();
  doc.rect(0, 0, PAGE_W, HEADER_H).fill(BLUE);
  if (logo) {
    try {
      doc.image(logo, MARGIN, 11, { fit: [47, 47] });
    } catch {}
  }
  doc
    .fillColor(WHITE)
    .fontSize(15)
    .font("Helvetica-Bold")
    .text("PROVISION CIVILS", MARGIN + 56, 17, { lineBreak: false });
  doc
    .fillColor("#BBDEFB")
    .fontSize(8)
    .font("Helvetica")
    .text("Construction Job Management", MARGIN + 56, 36, { lineBreak: false });
  doc
    .fillColor(WHITE)
    .fontSize(9)
    .font("Helvetica-Bold")
    .text(subtitle, 0, 27, { align: "right", width: PAGE_W - MARGIN });
  doc.fillColor(DARK).font("Helvetica").fontSize(10);
}

function addFooters(doc: PDFKit.PDFDocument): void {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    const y = PAGE_H - FOOTER_H;
    doc.rect(0, y, PAGE_W, FOOTER_H).fill(BLUE);
    doc
      .fillColor(WHITE)
      .fontSize(7)
      .font("Helvetica")
      .text(
        `PROVISION CIVILS  ·  Construction Job Management  ·  Page ${i + 1} of ${range.count}  ·  Confidential`,
        0,
        y + 10,
        { align: "center" }
      );
  }
  doc.fillColor(DARK);
}

function ensureSpace(
  doc: PDFKit.PDFDocument,
  y: number,
  needed: number,
  subtitle: string
): number {
  if (y + needed > SAFE_BOTTOM) {
    doc.addPage();
    drawHeader(doc, subtitle);
    return HEADER_H + 14;
  }
  return y;
}

function rule(doc: PDFKit.PDFDocument, y: number, color = BORDER): number {
  doc
    .moveTo(MARGIN, y)
    .lineTo(PAGE_W - MARGIN, y)
    .strokeColor(color)
    .lineWidth(0.5)
    .stroke();
  return y + 10;
}

function sectionBar(
  doc: PDFKit.PDFDocument,
  label: string,
  y: number
): number {
  doc.rect(MARGIN, y, CONTENT_W, 20).fill(BLUE);
  doc
    .fillColor(WHITE)
    .fontSize(8.5)
    .font("Helvetica-Bold")
    .text(label, MARGIN + 8, y + 6, { lineBreak: false });
  doc.fillColor(DARK).font("Helvetica");
  return y + 28;
}

function infoGrid(
  doc: PDFKit.PDFDocument,
  items: [string, string | null | undefined][],
  y: number,
  cols = 2
): number {
  const colW = CONTENT_W / cols;
  let row = 0;
  let col = 0;
  for (const [label, value] of items) {
    const x = MARGIN + col * colW;
    doc
      .fillColor(MUTED)
      .fontSize(7)
      .font("Helvetica")
      .text(label, x, y + row * 42);
    doc
      .fillColor(DARK)
      .fontSize(10)
      .font("Helvetica-Bold")
      .text(value || "—", x, y + row * 42 + 11, {
        width: colW - 16,
        lineBreak: false,
      });
    col++;
    if (col >= cols) {
      col = 0;
      row++;
    }
  }
  return y + Math.ceil(items.length / cols) * 42 + 8;
}

function drawMaterialsTable(
  doc: PDFKit.PDFDocument,
  materials: any[],
  y: number,
  headerTitle: string
): number {
  const COLS = [200, 55, 65, 100, 95];
  const HEADERS = ["Material / Description", "Qty", "Unit", "Unit Cost", "Status"];
  const ROW_H = 19;
  const HEAD_H = 21;

  const drawTableHead = (ty: number): number => {
    let x = MARGIN;
    doc.rect(MARGIN, ty, CONTENT_W, HEAD_H).fill(BLUE);
    for (let i = 0; i < HEADERS.length; i++) {
      doc
        .fillColor(WHITE)
        .fontSize(8)
        .font("Helvetica-Bold")
        .text(HEADERS[i], x + 4, ty + 7, {
          width: COLS[i] - 6,
          lineBreak: false,
        });
      x += COLS[i];
    }
    doc.fillColor(DARK).font("Helvetica");
    return ty + HEAD_H;
  };

  y = drawTableHead(y);

  if (!materials.length) {
    doc.rect(MARGIN, y, CONTENT_W, ROW_H).fill("#FAFAFA");
    doc
      .fillColor(MUTED)
      .fontSize(9)
      .font("Helvetica-Oblique")
      .text("No materials recorded for this job.", MARGIN + 5, y + 6, {
        lineBreak: false,
      });
    doc.fillColor(DARK).font("Helvetica");
    return y + ROW_H + 8;
  }

  let totalCost = 0;

  for (let ri = 0; ri < materials.length; ri++) {
    if (y + ROW_H > SAFE_BOTTOM - 30) {
      doc.addPage();
      drawHeader(doc, headerTitle);
      y = HEADER_H + 16;
      y = drawTableHead(y);
    }

    const m = materials[ri];
    const qty = Number(m.quantity ?? 0);
    const unitCost = m.cost != null ? Number(m.cost) : null;
    const lineCost = unitCost != null ? qty * unitCost : null;
    if (lineCost != null) totalCost += lineCost;

    const bg = ri % 2 === 0 ? WHITE : LIGHT;
    doc.rect(MARGIN, y, CONTENT_W, ROW_H).fill(bg);

    const vals = [
      { t: m.name || "—", c: DARK },
      { t: String(qty), c: DARK },
      { t: m.unit || "units", c: MUTED },
      { t: unitCost != null ? "R " + unitCost.toFixed(2) : "—", c: DARK },
      { t: m.checked ? "✓ Delivered" : "○ Pending", c: m.checked ? GREEN : ORANGE },
    ];

    let x = MARGIN;
    for (let ci = 0; ci < vals.length; ci++) {
      doc
        .fillColor(vals[ci].c)
        .fontSize(9)
        .font("Helvetica")
        .text(vals[ci].t, x + 4, y + 5, {
          width: COLS[ci] - 6,
          lineBreak: false,
        });
      x += COLS[ci];
    }
    y += ROW_H;
  }

  doc.rect(MARGIN, y, CONTENT_W, ROW_H + 2).fill("#E3F2FD");
  doc
    .fillColor(BLUE)
    .fontSize(9)
    .font("Helvetica-Bold")
    .text(
      `TOTAL: ${materials.length} item${materials.length !== 1 ? "s" : ""}`,
      MARGIN + 6,
      y + 7,
      { lineBreak: false }
    );
  if (totalCost > 0) {
    const tcStr = "R " + totalCost.toLocaleString("en-ZA", { minimumFractionDigits: 2 });
    doc
      .fillColor(BLUE)
      .fontSize(9)
      .font("Helvetica-Bold")
      .text(tcStr, MARGIN + COLS[0] + COLS[1] + COLS[2] + 4, y + 7, {
        lineBreak: false,
      });
  }
  doc.fillColor(DARK).font("Helvetica");
  return y + ROW_H + 16;
}

export function generateMaterialsPDF(
  job: any,
  materials: any[],
  res: Response
): void {
  const doc = new PDFDocument({ size: "A4", bufferPages: true });
  const filename = `${job.jobNumber ?? "JOB"}-Materials-${new Date().toISOString().slice(0, 10)}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-cache");
  doc.pipe(res);

  drawHeader(doc, "MATERIAL USAGE REPORT");
  let y = HEADER_H + 16;

  doc
    .fillColor(DARK)
    .fontSize(20)
    .font("Helvetica-Bold")
    .text("MATERIAL USAGE REPORT", MARGIN, y);
  y += 30;
  doc
    .fillColor(MUTED)
    .fontSize(9)
    .font("Helvetica")
    .text(
      `Generated: ${new Date().toLocaleDateString("en-ZA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
      MARGIN,
      y
    );
  y += 22;
  y = rule(doc, y);

  y = sectionBar(doc, "JOB DETAILS", y);
  y = infoGrid(
    doc,
    [
      ["Job Number", job.jobNumber],
      ["Project Name", job.projectName],
      ["Client", job.clientName],
      ["Site Address", job.siteAddress],
      ["Start Date", formatDate(job.startDate)],
      ["Due Date", formatDate(job.dueDate)],
      ["Contract Value", formatCurrency(job.contractValue)],
      ["Status", (job.status || "").replace(/_/g, " ").toUpperCase()],
    ],
    y,
    2
  );

  y = rule(doc, y);
  y = sectionBar(
    doc,
    `MATERIALS LIST — ${materials.length} ITEM${materials.length !== 1 ? "S" : ""}`,
    y
  );
  y = drawMaterialsTable(doc, materials, y, "MATERIAL USAGE REPORT");

  if (y + 70 < SAFE_BOTTOM) {
    y = rule(doc, y);
    doc
      .fillColor(MUTED)
      .fontSize(8)
      .font("Helvetica")
      .text("Prepared by:", MARGIN, y);
    doc
      .moveTo(MARGIN + 80, y + 16)
      .lineTo(MARGIN + 280, y + 16)
      .strokeColor(BORDER)
      .lineWidth(0.5)
      .stroke();
    doc
      .fillColor(MUTED)
      .fontSize(7.5)
      .text("Signature", MARGIN + 80, y + 18);
    doc
      .fillColor(MUTED)
      .fontSize(8)
      .text("Date:", MARGIN + 310, y);
    doc
      .moveTo(MARGIN + 335, y + 16)
      .lineTo(PAGE_W - MARGIN, y + 16)
      .strokeColor(BORDER)
      .lineWidth(0.5)
      .stroke();
  }

  addFooters(doc);
  doc.end();
}

export function generateReportsPDF(
  job: any,
  reports: any[],
  userMap: Record<number, string>,
  res: Response
): void {
  const doc = new PDFDocument({ size: "A4", bufferPages: true });
  const filename = `${job.jobNumber ?? "JOB"}-DailyReports-${new Date().toISOString().slice(0, 10)}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-cache");
  doc.pipe(res);

  const sorted = [...reports].sort((a, b) => (a.date < b.date ? -1 : 1));

  drawHeader(doc, "DAILY REPORTS");
  let y = HEADER_H + 16;

  doc
    .fillColor(DARK)
    .fontSize(20)
    .font("Helvetica-Bold")
    .text("DAILY REPORTS", MARGIN, y);
  y += 30;
  doc
    .fillColor(MUTED)
    .fontSize(10)
    .font("Helvetica")
    .text(
      `${reports.length} report${reports.length !== 1 ? "s" : ""} on record`,
      MARGIN,
      y
    );
  y += 16;
  if (sorted.length > 0) {
    doc
      .fillColor(MUTED)
      .fontSize(9)
      .text(
        `Period: ${formatDate(sorted[0].date)} — ${formatDate(sorted[sorted.length - 1].date)}`,
        MARGIN,
        y
      );
    y += 18;
  }
  y = rule(doc, y);
  y = sectionBar(doc, "JOB DETAILS", y);
  y = infoGrid(
    doc,
    [
      ["Job Number", job.jobNumber],
      ["Project Name", job.projectName],
      ["Client", job.clientName],
      ["Site Address", job.siteAddress],
      ["Start Date", formatDate(job.startDate)],
      ["Due Date", formatDate(job.dueDate)],
    ],
    y,
    2
  );

  for (const report of sorted) {
    doc.addPage();
    drawHeader(doc, "DAILY REPORTS");
    y = HEADER_H + 14;

    doc.rect(MARGIN, y, CONTENT_W, 28).fill("#E3F2FD");
    doc
      .fillColor(BLUE)
      .fontSize(13)
      .font("Helvetica-Bold")
      .text(formatDate(report.date), MARGIN + 10, y + 8, { lineBreak: false });
    const supervisor = userMap[report.userId] || `User ${report.userId}`;
    doc
      .fillColor(MUTED)
      .fontSize(8.5)
      .font("Helvetica")
      .text(`Supervisor: ${supervisor}`, PAGE_W - MARGIN - 180, y + 10, {
        lineBreak: false,
      });
    doc.fillColor(DARK).font("Helvetica");
    y += 36;

    const metaItems: [string, string | null | undefined][] = [
      ["Date", formatDate(report.date)],
      ["Submitted", report.createdAt ? new Date(report.createdAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" }) : null],
    ];
    if (report.gpsLat && report.gpsLng) {
      metaItems.push(["GPS Location", `${Number(report.gpsLat).toFixed(5)}, ${Number(report.gpsLng).toFixed(5)}`]);
    }
    metaItems.push(["Supervisor", supervisor]);
    y = infoGrid(doc, metaItems, y, 2);
    y = rule(doc, y);

    const sections: [string, string | null | undefined, boolean][] = [
      ["WORK COMPLETED TODAY", report.workCompleted || report.progressNotes, true],
      ["LABOUR ON SITE", report.labourOnSite, false],
      ["PROBLEMS & DELAYS", report.problemsEncountered, false],
      ["TOMORROW'S PLANNED WORK", report.tomorrowWork, false],
      ["VOICE-TO-TEXT / ADDITIONAL NOTES", report.notes, false],
    ];

    for (const [label, content] of sections) {
      if (!content) continue;
      const textLines = Math.ceil(content.length / 90);
      const estH = textLines * 14 + 50;
      if (y + estH > SAFE_BOTTOM - 20) {
        doc.addPage();
        drawHeader(doc, "DAILY REPORTS");
        y = HEADER_H + 14;
      }
      y = sectionBar(doc, label, y);
      doc
        .fillColor(DARK)
        .fontSize(10)
        .font("Helvetica")
        .text(content, MARGIN + 8, y, { width: CONTENT_W - 16, lineBreak: true });
      y = doc.y + 12;
      y = rule(doc, y);
    }

    if (report.photoUris?.length > 0) {
      if (y + 130 > SAFE_BOTTOM) {
        doc.addPage();
        drawHeader(doc, "DAILY REPORTS");
        y = HEADER_H + 14;
      }
      y = sectionBar(doc, `PHOTOS (${report.photoUris.length})`, y);
      const PW = 155, PH = 116;
      let px = MARGIN;
      let maxY = y;
      for (let i = 0; i < Math.min(report.photoUris.length, 6); i++) {
        const buf = b64ToBuffer(report.photoUris[i]);
        if (buf) {
          try {
            doc.image(buf, px, y, { fit: [PW, PH] });
            maxY = Math.max(maxY, y + PH);
          } catch {}
        }
        px += PW + 12;
        if (px + PW > PAGE_W - MARGIN) {
          px = MARGIN;
          y = maxY + 8;
          if (y + PH > SAFE_BOTTOM) break;
        }
      }
      y = maxY + 16;
    }
  }

  addFooters(doc);
  doc.end();
}

export function generateCompletionPDF(
  job: any,
  reports: any[],
  materials: any[],
  photos: any[],
  userMap: Record<number, string>,
  res: Response
): void {
  const doc = new PDFDocument({ size: "A4", bufferPages: true, autoFirstPage: true });
  const filename = `${job.jobNumber ?? "JOB"}-CompletionPack-${new Date().toISOString().slice(0, 10)}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-cache");
  doc.pipe(res);

  const logo = getLogoBuffer();
  const subtitle = "PROJECT COMPLETION PACK";
  const sorted = [...reports].sort((a, b) => (a.date < b.date ? -1 : 1));

  // ── PAGE 1: COVER ────────────────────────────────────────────────
  doc.rect(0, 0, PAGE_W, PAGE_H).fill(BLUE);
  doc.rect(0, 0, PAGE_W, 158).fill(DARK);

  if (logo) {
    try { doc.image(logo, PAGE_W / 2 - 44, 22, { width: 88, height: 88 }); } catch {}
  }
  doc.fillColor(WHITE).fontSize(9).font("Helvetica")
    .text("CONSTRUCTION JOB MANAGEMENT", 0, 122, { align: "center" });
  doc.fillColor(WHITE).fontSize(30).font("Helvetica-Bold")
    .text("PROJECT", 0, 196, { align: "center" });
  doc.fillColor(ORANGE).fontSize(30).font("Helvetica-Bold")
    .text("COMPLETION PACK", 0, 234, { align: "center" });
  doc.fillColor(WHITE).fontSize(14).font("Helvetica-Bold")
    .text(job.jobNumber ?? "—", 0, 290, { align: "center" });
  doc.fillColor("#BBDEFB").fontSize(11).font("Helvetica")
    .text(job.projectName ?? job.clientName ?? "—", 0, 310, { align: "center" });

  const coverData: [string, string][] = [
    ["Client", job.clientName ?? "—"],
    ["Site Address", job.siteAddress ?? "—"],
    ["Completion Date", formatDate(new Date().toISOString())],
    ["Contract Value", formatCurrency(job.contractValue)],
    ["Daily Reports", String(reports.length)],
    ["Materials on Record", String(materials.length)],
  ];
  let cy = 358;
  for (const [k, v] of coverData) {
    doc.fillColor("#90CAF9").fontSize(7.5).font("Helvetica")
      .text(k, MARGIN + 80, cy, { lineBreak: false });
    doc.fillColor(WHITE).fontSize(10).font("Helvetica-Bold")
      .text(v, MARGIN + 80, cy + 11, { lineBreak: false });
    cy += 30;
  }
  doc.fillColor("#BBDEFB").fontSize(7).font("Helvetica")
    .text("PROVISION CIVILS  ·  Construction Job Management  ·  Confidential Document",
      0, PAGE_H - 32, { align: "center" });

  // ── PAGE 2+: FLOWING CONTENT ─────────────────────────────────────
  doc.addPage();
  drawHeader(doc, subtitle);
  let y = HEADER_H + 14;

  // ── PROJECT INFORMATION ──────────────────────────────────────────
  y = sectionBar(doc, "PROJECT INFORMATION", y);
  y = infoGrid(doc, [
    ["Job Number", job.jobNumber],
    ["Project Name", job.projectName],
    ["Client", job.clientName],
    ["Client Phone", job.clientPhone],
    ["Client Email", job.clientEmail],
    ["Site Address", job.siteAddress],
    ["Start Date", formatDate(job.startDate)],
    ["Due Date", formatDate(job.dueDate)],
    ["Contract Value", formatCurrency(job.contractValue)],
    ["PO Number", job.poNumber],
    ["Wayleave Required", job.wayleaveRequired ? "YES" : "NO"],
    ["Status", (job.status || "completed").replace(/_/g, " ").toUpperCase()],
  ], y, 2);

  // ── DAILY REPORTS SUMMARY (skip if none) ────────────────────────
  if (sorted.length > 0) {
    y = ensureSpace(doc, y + 8, 100, subtitle);
    y = sectionBar(
      doc,
      `DAILY REPORTS  —  ${sorted.length} REPORT${sorted.length !== 1 ? "S" : ""}`,
      y
    );

    for (const report of sorted) {
      const sup = userMap[report.userId] || `User ${report.userId}`;
      const workText = ((report.workCompleted || report.progressNotes) ?? "").slice(0, 280);
      const problemText = (report.problemsEncountered ?? "").slice(0, 180);
      const notesText = (report.notes ?? "").slice(0, 180);
      const labourText = report.labourOnSite ?? "";
      const tomorrowText = (report.tomorrowWork ?? "").slice(0, 180);

      const estLines = (workText ? Math.ceil(workText.length / 95) : 0)
        + (problemText ? Math.ceil(problemText.length / 95) : 0)
        + (labourText ? 1 : 0) + (tomorrowText ? 1 : 0) + (notesText ? 1 : 0);
      const estH = 30 + estLines * 13 + 24;
      y = ensureSpace(doc, y, estH, subtitle);

      // Report header
      doc.rect(MARGIN, y, CONTENT_W, 22).fill("#E3F2FD");
      doc.fillColor(BLUE).fontSize(9).font("Helvetica-Bold")
        .text(formatDate(report.date), MARGIN + 8, y + 7, { lineBreak: false });
      doc.fillColor(MUTED).fontSize(8).font("Helvetica")
        .text(`Supervisor: ${sup}`, PAGE_W - MARGIN - 180, y + 8, { lineBreak: false });
      doc.fillColor(DARK).font("Helvetica");
      y += 26;

      if (workText) {
        doc.fillColor(MUTED).fontSize(7.5).font("Helvetica")
          .text("Work completed:", MARGIN + 8, y);
        y += 11;
        doc.fillColor(DARK).fontSize(9).font("Helvetica")
          .text(workText, MARGIN + 8, y, { width: CONTENT_W - 16 });
        y = doc.y + 4;
      }
      if (problemText) {
        doc.fillColor(RED).fontSize(7.5).font("Helvetica")
          .text("Problems / Delays:", MARGIN + 8, y);
        y += 11;
        doc.fillColor(DARK).fontSize(9).font("Helvetica")
          .text(problemText, MARGIN + 8, y, { width: CONTENT_W - 16 });
        y = doc.y + 4;
      }
      if (labourText) {
        doc.fillColor(MUTED).fontSize(8.5).font("Helvetica")
          .text(`Labour on site: ${labourText}`, MARGIN + 8, y, { width: CONTENT_W - 16 });
        y = doc.y + 4;
      }
      if (tomorrowText) {
        doc.fillColor(MUTED).fontSize(8.5).font("Helvetica")
          .text(`Planned tomorrow: ${tomorrowText}`, MARGIN + 8, y, { width: CONTENT_W - 16 });
        y = doc.y + 4;
      }
      if (notesText) {
        doc.fillColor(MUTED).fontSize(8.5).font("Helvetica")
          .text(`Notes: ${notesText}`, MARGIN + 8, y, { width: CONTENT_W - 16 });
        y = doc.y + 4;
      }

      y = rule(doc, y + 2);
    }
  }

  // ── MATERIAL USAGE ───────────────────────────────────────────────
  y = ensureSpace(doc, y + 6, 100, subtitle);
  y = sectionBar(
    doc,
    `MATERIAL USAGE  —  ${materials.length} ITEM${materials.length !== 1 ? "S" : ""}`,
    y
  );
  y = drawMaterialsTable(doc, materials, y, subtitle);

  // ── WAYLEAVE STATUS (only if required) ──────────────────────────
  if (job.wayleaveRequired) {
    y = ensureSpace(doc, y + 6, 58, subtitle);
    y = sectionBar(doc, "WAYLEAVE STATUS", y);
    doc.rect(MARGIN, y, CONTENT_W, 38).fill("#FFF8E1");
    doc.fillColor(ORANGE).fontSize(9).font("Helvetica-Bold")
      .text("WAYLEAVE REQUIRED", MARGIN + 12, y + 8, { lineBreak: false });
    doc.fillColor(DARK).fontSize(8.5).font("Helvetica")
      .text(
        "This project required a Wayleave permit. Supporting documents must be filed with this pack.",
        MARGIN + 12, y + 22, { width: CONTENT_W - 24, lineBreak: false }
      );
    doc.fillColor(DARK).font("Helvetica");
    y += 46;
  }

  // ── CERTIFICATE OF COMPLETION — always own page ──────────────────
  doc.addPage();
  drawHeader(doc, subtitle);
  y = HEADER_H + 22;

  // Outer border
  doc.rect(MARGIN, y, CONTENT_W, 376).strokeColor(BLUE).lineWidth(2).stroke();
  // Orange top accent
  doc.rect(MARGIN, y, CONTENT_W, 6).fill(ORANGE);
  y += 30;

  doc.fillColor(BLUE).fontSize(20).font("Helvetica-Bold")
    .text("CERTIFICATE OF COMPLETION", 0, y, { align: "center" });
  y += 28;
  doc.moveTo(MARGIN + 50, y).lineTo(PAGE_W - MARGIN - 50, y)
    .strokeColor(ORANGE).lineWidth(1.5).stroke();
  y += 18;

  doc.fillColor(DARK).fontSize(9.5).font("Helvetica")
    .text(
      "This is to certify that the following project has been completed in accordance\nwith the agreed specifications and to the satisfaction of the client:",
      0, y, { align: "center" }
    );
  y += 34;

  doc.fillColor(BLUE).fontSize(17).font("Helvetica-Bold")
    .text(job.projectName || job.clientName || "—", 0, y, { align: "center" });
  y += 22;
  doc.fillColor(DARK).fontSize(11).font("Helvetica-Bold")
    .text(job.jobNumber ?? "—", 0, y, { align: "center" });
  y += 26;

  doc.moveTo(MARGIN + 50, y).lineTo(PAGE_W - MARGIN - 50, y)
    .strokeColor(BORDER).lineWidth(0.5).stroke();
  y += 16;

  const certItems: [string, string][] = [
    ["Client", job.clientName ?? "—"],
    ["Site Address", job.siteAddress ?? "—"],
    ["Completion Date", formatDate(new Date().toISOString())],
    ["Contract Value", formatCurrency(job.contractValue)],
    ["Total Daily Reports", String(reports.length)],
    ["Materials on Record", String(materials.length)],
  ];
  for (const [k, v] of certItems) {
    doc.fillColor(MUTED).fontSize(8.5).font("Helvetica")
      .text(`${k}:`, MARGIN + 80, y, { lineBreak: false });
    doc.fillColor(DARK).fontSize(9).font("Helvetica-Bold")
      .text(v, MARGIN + 216, y, { lineBreak: false });
    y += 18;
  }
  y += 20;

  // Supervisor signature
  doc.fillColor(MUTED).fontSize(8.5).font("Helvetica")
    .text("Supervisor Signature:", MARGIN + 30, y, { lineBreak: false });
  doc.moveTo(MARGIN + 152, y + 26).lineTo(MARGIN + 310, y + 26)
    .strokeColor(DARK).lineWidth(0.8).stroke();
  doc.fillColor(MUTED).fontSize(7.5).font("Helvetica")
    .text("Signature", MARGIN + 152, y + 28);
  doc.fillColor(MUTED).fontSize(8.5).font("Helvetica")
    .text("Date:", MARGIN + 330, y, { lineBreak: false });
  doc.moveTo(MARGIN + 356, y + 26).lineTo(MARGIN + 490, y + 26)
    .strokeColor(DARK).lineWidth(0.8).stroke();
  y += 48;

  // Client acceptance
  doc.fillColor(MUTED).fontSize(8.5).font("Helvetica")
    .text("Client Acceptance:", MARGIN + 30, y, { lineBreak: false });
  doc.moveTo(MARGIN + 152, y + 26).lineTo(MARGIN + 310, y + 26)
    .strokeColor(DARK).lineWidth(0.8).stroke();
  doc.fillColor(MUTED).fontSize(7.5).font("Helvetica")
    .text("Signature", MARGIN + 152, y + 28);
  doc.fillColor(MUTED).fontSize(8.5).font("Helvetica")
    .text("Date:", MARGIN + 330, y, { lineBreak: false });
  doc.moveTo(MARGIN + 356, y + 26).lineTo(MARGIN + 490, y + 26)
    .strokeColor(DARK).lineWidth(0.8).stroke();
  y += 48;

  doc.fillColor(DARK).fontSize(7.5).font("Helvetica-Oblique")
    .text(
      "This document has been generated by Provision Civils Construction Job Management System.",
      0, y + 4, { align: "center" }
    );

  addFooters(doc);
  doc.end();
}

export function generatePhotosPDF(
  job: any,
  jobPhotos: { uri: string; caption?: string | null; createdAt: string }[],
  reportPhotos: { uri: string; date: string; label: string }[],
  res: Response
): void {
  const doc = new PDFDocument({ size: "A4", bufferPages: true, autoFirstPage: true });
  const filename = `${job.jobNumber ?? "JOB"}-PhotoReport-${new Date().toISOString().slice(0, 10)}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-cache");
  doc.pipe(res);

  const subtitle = "PHOTO REPORT";
  const logo = getLogoBuffer();
  const total = jobPhotos.length + reportPhotos.length;

  // ── COVER ─────────────────────────────────────────────────────────
  doc.rect(0, 0, PAGE_W, PAGE_H).fill(BLUE);
  doc.rect(0, 0, PAGE_W, 158).fill(DARK);
  if (logo) {
    try { doc.image(logo, PAGE_W / 2 - 44, 22, { width: 88, height: 88 }); } catch {}
  }
  doc.fillColor(WHITE).fontSize(9).font("Helvetica")
    .text("CONSTRUCTION JOB MANAGEMENT", 0, 122, { align: "center" });
  doc.fillColor(WHITE).fontSize(30).font("Helvetica-Bold")
    .text("PHOTO", 0, 200, { align: "center" });
  doc.fillColor(ORANGE).fontSize(30).font("Helvetica-Bold")
    .text("REPORT", 0, 238, { align: "center" });
  doc.fillColor(WHITE).fontSize(14).font("Helvetica-Bold")
    .text(job.jobNumber ?? "—", 0, 292, { align: "center" });
  doc.fillColor("#BBDEFB").fontSize(11).font("Helvetica")
    .text(job.projectName ?? job.clientName ?? "—", 0, 314, { align: "center" });
  const pCover: [string, string][] = [
    ["Client", job.clientName ?? "—"],
    ["Site Address", job.siteAddress ?? "—"],
    ["Report Date", formatDate(new Date().toISOString())],
    ["Total Photos", String(total)],
    ["Job Photos", String(jobPhotos.length)],
    ["Report Photos", String(reportPhotos.length)],
  ];
  let pcy = 360;
  for (const [k, v] of pCover) {
    doc.fillColor("#90CAF9").fontSize(7.5).font("Helvetica")
      .text(k, MARGIN + 80, pcy, { lineBreak: false });
    doc.fillColor(WHITE).fontSize(10).font("Helvetica-Bold")
      .text(v, MARGIN + 80, pcy + 11, { lineBreak: false });
    pcy += 28;
  }
  doc.fillColor("#BBDEFB").fontSize(7).font("Helvetica")
    .text("PROVISION CIVILS  ·  Construction Job Management  ·  Confidential Document",
      0, PAGE_H - 32, { align: "center" });

  const PW = 155, PH = 120;

  // ── JOB PHOTOS ────────────────────────────────────────────────────
  if (jobPhotos.length > 0) {
    doc.addPage(); drawHeader(doc, subtitle);
    let y = HEADER_H + 14;
    y = sectionBar(doc, `JOB SITE PHOTOS  —  ${jobPhotos.length}`, y);
    let px = MARGIN, rowMaxY = y;
    for (let i = 0; i < jobPhotos.length; i++) {
      if (y + PH + 20 > SAFE_BOTTOM) {
        doc.addPage(); drawHeader(doc, subtitle);
        y = HEADER_H + 14; px = MARGIN; rowMaxY = y;
      }
      const buf = b64ToBuffer(jobPhotos[i].uri);
      if (buf) {
        try {
          doc.image(buf, px, y, { fit: [PW, PH] });
          doc.fillColor(MUTED).fontSize(7).font("Helvetica")
            .text(jobPhotos[i].caption || `Photo ${i + 1}`, px, y + PH + 2, { width: PW, lineBreak: false });
          rowMaxY = Math.max(rowMaxY, y + PH + 16);
        } catch {}
      }
      px += PW + 11;
      if (px + PW > PAGE_W - MARGIN) { px = MARGIN; y = rowMaxY + 6; rowMaxY = y; }
    }
  }

  // ── REPORT PHOTOS ─────────────────────────────────────────────────
  if (reportPhotos.length > 0) {
    doc.addPage(); drawHeader(doc, subtitle);
    let y = HEADER_H + 14;
    y = sectionBar(doc, `DAILY REPORT PHOTOS  —  ${reportPhotos.length}`, y);
    let px = MARGIN, rowMaxY = y;
    for (let i = 0; i < reportPhotos.length; i++) {
      if (y + PH + 20 > SAFE_BOTTOM) {
        doc.addPage(); drawHeader(doc, subtitle);
        y = HEADER_H + 14; px = MARGIN; rowMaxY = y;
      }
      const buf = b64ToBuffer(reportPhotos[i].uri);
      if (buf) {
        try {
          doc.image(buf, px, y, { fit: [PW, PH] });
          doc.fillColor(MUTED).fontSize(7).font("Helvetica")
            .text(reportPhotos[i].label, px, y + PH + 2, { width: PW, lineBreak: false });
          rowMaxY = Math.max(rowMaxY, y + PH + 16);
        } catch {}
      }
      px += PW + 11;
      if (px + PW > PAGE_W - MARGIN) { px = MARGIN; y = rowMaxY + 6; rowMaxY = y; }
    }
  }

  addFooters(doc);
  doc.end();
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYROLL PDF GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Payroll summary table helper ──────────────────────────────────────────────
function drawPayrollTable(
  doc: PDFKit.PDFDocument,
  rows: any[],
  subtitle: string
): void {
  const COLS = [135, 45, 45, 52, 66, 55, 61, 56];
  const HEADERS = ["Employee Name", "Emp #", "Clock #", "Hours", "Hourly Pay", "Meters", "Piece Pay", "Gross Pay"];
  const ROW_H = 20;
  const HEAD_H = 22;

  const drawHead = (ty: number): number => {
    let x = MARGIN;
    doc.rect(MARGIN, ty, CONTENT_W, HEAD_H).fill("#0D47A1");
    for (let i = 0; i < HEADERS.length; i++) {
      doc.fillColor(WHITE).fontSize(7.5).font("Helvetica-Bold")
        .text(HEADERS[i], x + 3, ty + 8, { width: COLS[i] - 4, lineBreak: false });
      x += COLS[i];
    }
    doc.fillColor(DARK).font("Helvetica");
    return ty + HEAD_H;
  };

  let y = doc.y;
  y = drawHead(y);

  if (!rows.length) {
    doc.rect(MARGIN, y, CONTENT_W, ROW_H).fill(LIGHT);
    doc.fillColor(MUTED).fontSize(9).font("Helvetica-Oblique")
      .text("No payroll data for this period.", MARGIN + 6, y + 6, { lineBreak: false });
    doc.fillColor(DARK).font("Helvetica");
    doc.y = y + ROW_H + 8;
    return;
  }

  let grandTotal = 0, grandHourly = 0, grandPiece = 0;

  for (let ri = 0; ri < rows.length; ri++) {
    if (y + ROW_H > SAFE_BOTTOM - 30) {
      doc.addPage(); drawHeader(doc, subtitle);
      y = HEADER_H + 16; y = drawHead(y);
    }
    const r = rows[ri];
    grandTotal  += r.totalAmount  ?? 0;
    grandHourly += r.hourlyAmount ?? 0;
    grandPiece  += r.pieceAmount  ?? 0;

    doc.rect(MARGIN, y, CONTENT_W, ROW_H).fill(ri % 2 === 0 ? WHITE : LIGHT);
    const vals = [
      { t: r.employeeName ?? "—",    c: DARK,     bold: true  },
      { t: r.employeeNumber ?? "—",  c: MUTED,    bold: false },
      { t: r.clockNumber ?? "—",     c: MUTED,    bold: false },
      { t: r.totalHours > 0 ? r.totalHours.toFixed(1) + " h" : "—", c: DARK, bold: false },
      { t: r.hourlyAmount > 0 ? formatCurrency(r.hourlyAmount) : "—", c: "#2563EB", bold: false },
      { t: r.totalMeters > 0 ? r.totalMeters.toFixed(0) + " m" : "—", c: DARK, bold: false },
      { t: r.pieceAmount > 0 ? formatCurrency(r.pieceAmount) : "—", c: "#8B5CF6", bold: false },
      { t: formatCurrency(r.totalAmount), c: GREEN, bold: true },
    ];
    let x = MARGIN;
    for (let ci = 0; ci < vals.length; ci++) {
      doc.fillColor(vals[ci].c).fontSize(8.5)
        .font(vals[ci].bold ? "Helvetica-Bold" : "Helvetica")
        .text(vals[ci].t, x + 3, y + 5, { width: COLS[ci] - 4, lineBreak: false });
      x += COLS[ci];
    }
    y += ROW_H;
  }

  // Totals footer row
  if (y + ROW_H + 4 > SAFE_BOTTOM) { doc.addPage(); drawHeader(doc, subtitle); y = HEADER_H + 16; }
  doc.rect(MARGIN, y, CONTENT_W, ROW_H + 4).fill("#E3F2FD");
  doc.fillColor(BLUE).fontSize(9).font("Helvetica-Bold")
    .text(`TOTAL — ${rows.length} employee${rows.length !== 1 ? "s" : ""}`, MARGIN + 4, y + 8, { lineBreak: false });

  const totX4 = MARGIN + COLS[0] + COLS[1] + COLS[2] + COLS[3];
  const totX6 = totX4 + COLS[4] + COLS[5];
  const totX7 = totX6 + COLS[6];

  doc.fillColor(BLUE).fontSize(9).font("Helvetica-Bold")
    .text(formatCurrency(grandHourly), totX4 + 3, y + 8, { width: COLS[4] - 4, lineBreak: false });
  doc.fillColor(BLUE).fontSize(9).font("Helvetica-Bold")
    .text(formatCurrency(grandPiece), totX6 + 3, y + 8, { width: COLS[6] - 4, lineBreak: false });
  doc.fillColor(ORANGE).fontSize(10).font("Helvetica-Bold")
    .text(formatCurrency(grandTotal), totX7 + 3, y + 7, { width: COLS[7] - 4, lineBreak: false });
  doc.fillColor(DARK).font("Helvetica");
  doc.y = y + ROW_H + 16;
}

// ── 1. Payroll Summary PDF ────────────────────────────────────────────────────
export function generatePayrollSummaryPDF(
  rows: any[],
  startDate: string,
  endDate: string,
  res: Response
): void {
  const doc = new PDFDocument({ size: "A4", bufferPages: true });
  const filename = `Payroll-Summary-${startDate || "all"}-${endDate || "all"}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-cache");
  doc.pipe(res);

  const subtitle = "PAYROLL SUMMARY REPORT";
  drawHeader(doc, subtitle);
  let y = HEADER_H + 16;

  doc.fillColor(DARK).fontSize(20).font("Helvetica-Bold").text("PAYROLL SUMMARY REPORT", MARGIN, y);
  y += 30;
  const periodStr = startDate && endDate
    ? `${formatDate(startDate)} – ${formatDate(endDate)}`
    : "All dates";
  doc.fillColor(MUTED).fontSize(9).font("Helvetica")
    .text(`Period: ${periodStr}  ·  Generated: ${new Date().toLocaleDateString("en-ZA", { dateStyle: "medium" })}`, MARGIN, y);
  y += 22;
  y = rule(doc, y);

  const grandTotal  = rows.reduce((s, r) => s + (r.totalAmount  ?? 0), 0);
  const grandHourly = rows.reduce((s, r) => s + (r.hourlyAmount ?? 0), 0);
  const grandPiece  = rows.reduce((s, r) => s + (r.pieceAmount  ?? 0), 0);

  y = sectionBar(doc, "PAYROLL OVERVIEW", y);
  y = infoGrid(doc, [
    ["Payroll Period",            periodStr],
    ["Total Employees",           String(rows.length)],
    ["Total Hourly Payroll",      formatCurrency(grandHourly)],
    ["Total Piece Work Payroll",  formatCurrency(grandPiece)],
  ], y, 2);

  // Grand total banner
  y += 4;
  doc.rect(MARGIN, y, CONTENT_W, 34).fill(BLUE);
  doc.fillColor(WHITE).fontSize(10).font("Helvetica-Bold")
    .text("GRAND TOTAL PAYROLL", MARGIN + 10, y + 12, { lineBreak: false });
  doc.fillColor(ORANGE).fontSize(14).font("Helvetica-Bold")
    .text(formatCurrency(grandTotal), 0, y + 10, { align: "right", width: PAGE_W - MARGIN - 10 });
  doc.fillColor(DARK).font("Helvetica");
  y += 44;

  y = rule(doc, y);
  y = sectionBar(doc, `EMPLOYEE BREAKDOWN — ${rows.length} EMPLOYEE${rows.length !== 1 ? "S" : ""}`, y);
  doc.y = y;
  drawPayrollTable(doc, rows, subtitle);

  addFooters(doc);
  doc.end();
}

// ── 2. Individual Employee Payroll PDF ────────────────────────────────────────
export function generateEmployeePayrollPDF(
  employee: { name: string; employeeNumber: string | null; clockNumber: string | null },
  summary: { totalHours: number; hourlyAmount: number; metersAt25: number; metersAt30: number; totalMeters: number; pieceAmount: number; totalAmount: number },
  entries: any[],
  startDate: string,
  endDate: string,
  res: Response
): void {
  const doc = new PDFDocument({ size: "A4", bufferPages: true });
  const safeName = employee.name.replace(/[^a-z0-9]/gi, "-");
  const filename = `Payroll-${safeName}-${startDate || "all"}-${endDate || "all"}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-cache");
  doc.pipe(res);

  const subtitle = "INDIVIDUAL PAYROLL REPORT";
  drawHeader(doc, subtitle);
  let y = HEADER_H + 16;

  doc.fillColor(DARK).fontSize(20).font("Helvetica-Bold").text("INDIVIDUAL PAYROLL REPORT", MARGIN, y);
  y += 30;
  const periodStr = startDate && endDate ? `${formatDate(startDate)} – ${formatDate(endDate)}` : "All dates";
  doc.fillColor(MUTED).fontSize(9).font("Helvetica")
    .text(`Generated: ${new Date().toLocaleDateString("en-ZA", { dateStyle: "medium" })}  ·  Period: ${periodStr}`, MARGIN, y);
  y += 22;
  y = rule(doc, y);

  y = sectionBar(doc, "EMPLOYEE DETAILS", y);
  y = infoGrid(doc, [
    ["Full Name",        employee.name],
    ["Employee Number",  employee.employeeNumber ?? "—"],
    ["Clock Number",     employee.clockNumber ?? "—"],
    ["Report Period",    periodStr],
  ], y, 2);

  y = rule(doc, y);

  // Earnings summary boxes
  y = sectionBar(doc, "EARNINGS SUMMARY", y);
  const boxW = (CONTENT_W - 16) / 3;
  const boxes = [
    { label: "Hourly Earnings",    value: formatCurrency(summary.hourlyAmount), sub: summary.totalHours > 0 ? `${summary.totalHours.toFixed(1)} hours worked` : null, color: "#2563EB" },
    { label: "Piece Work Earnings", value: formatCurrency(summary.pieceAmount),  sub: summary.totalMeters > 0 ? `${summary.totalMeters.toFixed(0)} m total` : null, color: "#8B5CF6" },
    { label: "TOTAL GROSS PAY",     value: formatCurrency(summary.totalAmount),   sub: null, color: ORANGE, dark: true },
  ];
  for (let i = 0; i < boxes.length; i++) {
    const bx = MARGIN + i * (boxW + 8);
    const bh = 56;
    doc.rect(bx, y, boxW, bh).fill(boxes[i].dark ? BLUE : boxes[i].color + "14");
    doc.rect(bx, y, boxW, 3).fill(boxes[i].color);
    doc.fillColor(boxes[i].dark ? "#BBDEFB" : MUTED).fontSize(7.5).font("Helvetica")
      .text(boxes[i].label, bx + 8, y + 10, { lineBreak: false });
    doc.fillColor(boxes[i].dark ? ORANGE : boxes[i].color).fontSize(14).font("Helvetica-Bold")
      .text(boxes[i].value, bx + 8, y + 22, { width: boxW - 16, lineBreak: false });
    if (boxes[i].sub) {
      doc.fillColor(boxes[i].dark ? "#93C5FD" : MUTED).fontSize(7.5).font("Helvetica")
        .text(boxes[i].sub!, bx + 8, y + 40, { lineBreak: false });
    }
  }
  doc.fillColor(DARK).font("Helvetica");
  y += 68;

  // Piece work breakdown if applicable
  if (summary.metersAt25 > 0 || summary.metersAt30 > 0) {
    y = infoGrid(doc, [
      ["Meters @ R25/m", summary.metersAt25 > 0 ? `${summary.metersAt25.toFixed(0)} m` : "—"],
      ["Meters @ R30/m", summary.metersAt30 > 0 ? `${summary.metersAt30.toFixed(0)} m` : "—"],
    ], y, 4);
  }

  y = rule(doc, y);

  const hourlyEntries = entries.filter(e => e.payrollType === "hourly").sort((a, b) => a.date < b.date ? -1 : 1);
  const pieceEntries  = entries.filter(e => e.payrollType === "piece_work").sort((a, b) => a.date < b.date ? -1 : 1);

  // Hourly entries table
  if (hourlyEntries.length > 0) {
    y = ensureSpace(doc, y, 50, subtitle);
    y = sectionBar(doc, `HOURLY ENTRIES — ${hourlyEntries.length}`, y);

    const HCOLS = [70, 95, 60, 60, 60, 60, 110];
    const HHDRS = ["Date", "Clock In/Out", "Hours", "Lunch", "Rate", "Amount", "Job"];
    const HROW  = 19;
    const HHEAD = 21;

    const drawHHead = (ty: number): number => {
      let x = MARGIN;
      doc.rect(MARGIN, ty, CONTENT_W, HHEAD).fill(BLUE);
      for (let i = 0; i < HHDRS.length; i++) {
        doc.fillColor(WHITE).fontSize(7.5).font("Helvetica-Bold")
          .text(HHDRS[i], x + 3, ty + 8, { width: HCOLS[i] - 4, lineBreak: false });
        x += HCOLS[i];
      }
      doc.fillColor(DARK).font("Helvetica");
      return ty + HHEAD;
    };

    y = drawHHead(y);

    for (let ri = 0; ri < hourlyEntries.length; ri++) {
      if (y + HROW > SAFE_BOTTOM - 20) {
        doc.addPage(); drawHeader(doc, subtitle); y = HEADER_H + 16; y = drawHHead(y);
      }
      const e = hourlyEntries[ri];
      doc.rect(MARGIN, y, CONTENT_W, HROW).fill(ri % 2 === 0 ? WHITE : LIGHT);
      const lunchStr = e.lunchBreakTaken ? "Yes (30 min)" : "No";
      const vals = [
        { t: formatDate(e.date),   c: DARK },
        { t: `${e.clockIn ?? "—"} – ${e.clockOut ?? "—"}`, c: MUTED },
        { t: e.hoursWorked ? Number(e.hoursWorked).toFixed(2) + " h" : "—", c: DARK },
        { t: lunchStr, c: e.lunchBreakTaken ? MUTED : "#F59E0B" },
        { t: e.rateUsed ? `R${e.rateUsed}/hr` : "—", c: MUTED },
        { t: formatCurrency(e.amountPayable ? Number(e.amountPayable) : 0), c: "#2563EB" },
        { t: e.jobNumber ? `${e.jobNumber}` : (e.jobName ?? "—"), c: MUTED },
      ];
      let x = MARGIN;
      for (let ci = 0; ci < vals.length; ci++) {
        doc.fillColor(vals[ci].c).fontSize(8.5).font("Helvetica")
          .text(vals[ci].t, x + 3, y + 5, { width: HCOLS[ci] - 4, lineBreak: false });
        x += HCOLS[ci];
      }
      y += HROW;
    }
    y += 10;
  }

  // Piece work entries table
  if (pieceEntries.length > 0) {
    y = ensureSpace(doc, y, 50, subtitle);
    y = sectionBar(doc, `PIECE WORK ENTRIES — ${pieceEntries.length}`, y);

    const PCOLS = [70, 90, 65, 65, 65, 60, 100];
    const PHDRS = ["Date", "Job", "Meters", "Rate", "Status", "Amount", "Chainage"];
    const PROW  = 19;
    const PHEAD = 21;

    const drawPHead = (ty: number): number => {
      let x = MARGIN;
      doc.rect(MARGIN, ty, CONTENT_W, PHEAD).fill("#6D28D9");
      for (let i = 0; i < PHDRS.length; i++) {
        doc.fillColor(WHITE).fontSize(7.5).font("Helvetica-Bold")
          .text(PHDRS[i], x + 3, ty + 8, { width: PCOLS[i] - 4, lineBreak: false });
        x += PCOLS[i];
      }
      doc.fillColor(DARK).font("Helvetica");
      return ty + PHEAD;
    };

    y = drawPHead(y);

    for (let ri = 0; ri < pieceEntries.length; ri++) {
      if (y + PROW > SAFE_BOTTOM - 20) {
        doc.addPage(); drawHeader(doc, subtitle); y = HEADER_H + 16; y = drawPHead(y);
      }
      const e = pieceEntries[ri];
      const isComplete = e.status === "complete";
      doc.rect(MARGIN, y, CONTENT_W, PROW).fill(ri % 2 === 0 ? WHITE : LIGHT);
      const chainageStr = e.startChainage && e.endChainage
        ? `${Number(e.startChainage).toFixed(0)}–${Number(e.endChainage).toFixed(0)} m`
        : "—";
      const vals = [
        { t: formatDate(e.date),  c: DARK },
        { t: e.jobNumber ?? (e.jobName ?? "—"), c: MUTED },
        { t: e.metersCompleted ? Number(e.metersCompleted).toFixed(0) + " m" : "—", c: DARK },
        { t: e.rateUsed ? `R${e.rateUsed}/m` : "—", c: MUTED },
        { t: isComplete ? "✓ Complete" : "Open", c: isComplete ? GREEN : ORANGE },
        { t: isComplete ? formatCurrency(Number(e.amountPayable ?? 0)) : "—", c: "#8B5CF6" },
        { t: chainageStr, c: MUTED },
      ];
      let x = MARGIN;
      for (let ci = 0; ci < vals.length; ci++) {
        doc.fillColor(vals[ci].c).fontSize(8.5).font("Helvetica")
          .text(vals[ci].t, x + 3, y + 5, { width: PCOLS[ci] - 4, lineBreak: false });
        x += PCOLS[ci];
      }
      y += PROW;
    }
    y += 10;
  }

  addFooters(doc);
  doc.end();
}

// ── 3. Job Payroll Cost PDF ───────────────────────────────────────────────────
export function generateJobPayrollCostPDF(
  job: any,
  rows: any[],
  startDate: string,
  endDate: string,
  res: Response
): void {
  const doc = new PDFDocument({ size: "A4", bufferPages: true });
  const filename = `Payroll-Job-${job.jobNumber ?? "JOB"}-${startDate || "all"}-${endDate || "all"}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-cache");
  doc.pipe(res);

  const subtitle = "JOB PAYROLL COST REPORT";
  drawHeader(doc, subtitle);
  let y = HEADER_H + 16;

  doc.fillColor(DARK).fontSize(20).font("Helvetica-Bold").text("JOB PAYROLL COST REPORT", MARGIN, y);
  y += 30;
  const periodStr = startDate && endDate ? `${formatDate(startDate)} – ${formatDate(endDate)}` : "All dates";
  doc.fillColor(MUTED).fontSize(9).font("Helvetica")
    .text(`Generated: ${new Date().toLocaleDateString("en-ZA", { dateStyle: "medium" })}  ·  Period: ${periodStr}`, MARGIN, y);
  y += 22;
  y = rule(doc, y);

  const totalLabour = rows.reduce((s, r) => s + (r.totalAmount ?? 0), 0);

  y = sectionBar(doc, "JOB DETAILS", y);
  y = infoGrid(doc, [
    ["Job Number",       job.jobNumber ?? "—"],
    ["Project Name",     job.projectName ?? "—"],
    ["Client",           job.clientName ?? "—"],
    ["Site Address",     job.siteAddress ?? "—"],
    ["Contract Value",   formatCurrency(job.contractValue)],
    ["Status",           (job.status ?? "").replace(/_/g, " ").toUpperCase()],
  ], y, 2);

  // Labour cost summary banner
  doc.rect(MARGIN, y, CONTENT_W, 34).fill(BLUE);
  doc.fillColor(WHITE).fontSize(10).font("Helvetica-Bold")
    .text(`TOTAL LABOUR COST — ${rows.length} WORKER${rows.length !== 1 ? "S" : ""}`, MARGIN + 10, y + 12, { lineBreak: false });
  doc.fillColor(ORANGE).fontSize(14).font("Helvetica-Bold")
    .text(formatCurrency(totalLabour), 0, y + 10, { align: "right", width: PAGE_W - MARGIN - 10 });
  doc.fillColor(DARK).font("Helvetica");
  y += 44;

  y = rule(doc, y);
  y = sectionBar(doc, `LABOUR BREAKDOWN BY EMPLOYEE — ${periodStr}`, y);
  doc.y = y;
  drawPayrollTable(doc, rows, subtitle);

  // Labour vs contract value
  if (job.contractValue) {
    const cv = Number(job.contractValue);
    if (!isNaN(cv) && cv > 0) {
      y = doc.y;
      y = ensureSpace(doc, y, 60, subtitle);
      y = rule(doc, y);
      y = sectionBar(doc, "COST ANALYSIS", y);
      const labourPct = totalLabour / cv * 100;
      y = infoGrid(doc, [
        ["Contract Value",      formatCurrency(cv)],
        ["Total Labour Cost",   formatCurrency(totalLabour)],
        ["Labour as % of Contract", `${labourPct.toFixed(1)}%`],
        ["Remaining Budget",    formatCurrency(cv - totalLabour)],
      ], y, 2);
    }
  }

  addFooters(doc);
  doc.end();
}
