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

      // Inline report photos (max 4, small)
      if (report.photoUris?.length > 0) {
        const PW2 = 108, PH2 = 80;
        const maxPh = Math.min(report.photoUris.length, 4);
        y = ensureSpace(doc, y + 4, PH2 + 14, subtitle);
        let px2 = MARGIN + 8;
        for (let i = 0; i < maxPh; i++) {
          const buf = b64ToBuffer(report.photoUris[i]);
          if (buf) {
            try { doc.image(buf, px2, y, { fit: [PW2, PH2] }); } catch {}
          }
          px2 += PW2 + 6;
          if (px2 + PW2 > PAGE_W - MARGIN - 8) break;
        }
        y += PH2 + 10;
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

  // ── SITE PHOTOS (job-level, skip if none) ────────────────────────
  const validPhotos = photos.filter(p => b64ToBuffer(p.uri) !== null);
  if (validPhotos.length > 0) {
    y = ensureSpace(doc, y + 8, 160, subtitle);
    y = sectionBar(
      doc,
      `SITE PHOTOS  —  ${validPhotos.length} PHOTO${validPhotos.length !== 1 ? "S" : ""}`,
      y
    );

    const PW = 152, PH = 114;
    let px = MARGIN;
    let rowMaxY = y;

    for (let i = 0; i < validPhotos.length; i++) {
      if (y + PH > SAFE_BOTTOM - 8) {
        doc.addPage();
        drawHeader(doc, subtitle);
        y = HEADER_H + 14;
        px = MARGIN;
        rowMaxY = y;
      }
      const buf = b64ToBuffer(validPhotos[i].uri);
      if (buf) {
        try {
          doc.image(buf, px, y, { fit: [PW, PH] });
          if (validPhotos[i].caption) {
            doc.fillColor(MUTED).fontSize(6.5)
              .text(validPhotos[i].caption, px, y + PH + 2, { width: PW, lineBreak: false });
          }
          rowMaxY = Math.max(rowMaxY, y + PH + 14);
        } catch {}
      }
      px += PW + 10;
      if (px + PW > PAGE_W - MARGIN) {
        px = MARGIN;
        y = rowMaxY;
        rowMaxY = y;
      }
    }
    y = rowMaxY + 8;
  }

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
