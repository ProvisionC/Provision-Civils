import { Router, type IRouter } from "express";
import {
  db,
  jobsTable,
  usersTable,
  jobMaterialsTable,
  jobPhotosTable,
  dailyReportsTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import {
  generateMaterialsPDF,
  generateReportsPDF,
  generateCompletionPDF,
  generatePhotosPDF,
} from "../utils/pdf-generator.js";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(s, 10);
}

async function buildUserMap(userIds: number[]): Promise<Record<number, string>> {
  if (!userIds.length) return {};
  const users = await db
    .select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable)
    .where(inArray(usersTable.id, userIds));
  const map: Record<number, string> = {};
  for (const u of users) {
    map[u.id] = u.name;
  }
  return map;
}

router.get(
  "/jobs/:id/pdf/materials",
  requireAuth,
  async (req, res): Promise<void> => {
    const id = parseId(req.params.id);
    if (!id || isNaN(id)) {
      res.status(400).json({ error: "Invalid job ID" });
      return;
    }
    try {
      const [job] = await db
        .select()
        .from(jobsTable)
        .where(eq(jobsTable.id, id));
      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }
      const materials = await db
        .select()
        .from(jobMaterialsTable)
        .where(eq(jobMaterialsTable.jobId, id))
        .orderBy(jobMaterialsTable.id);

      generateMaterialsPDF(job, materials, res);
    } catch (err) {
      req.log?.error({ err }, "PDF materials generation failed");
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to generate PDF" });
      }
    }
  }
);

router.get(
  "/jobs/:id/pdf/reports",
  requireAuth,
  async (req, res): Promise<void> => {
    const id = parseId(req.params.id);
    if (!id || isNaN(id)) {
      res.status(400).json({ error: "Invalid job ID" });
      return;
    }
    try {
      const [job] = await db
        .select()
        .from(jobsTable)
        .where(eq(jobsTable.id, id));
      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }
      const reports = await db
        .select()
        .from(dailyReportsTable)
        .where(eq(dailyReportsTable.jobId, id))
        .orderBy(dailyReportsTable.date);

      const userIds = [
        ...new Set(reports.map((r) => r.userId).filter((u): u is number => u != null)),
      ];
      const userMap = await buildUserMap(userIds);

      generateReportsPDF(job, reports, userMap, res);
    } catch (err) {
      req.log?.error({ err }, "PDF reports generation failed");
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to generate PDF" });
      }
    }
  }
);

router.get(
  "/jobs/:id/pdf/completion",
  requireAuth,
  async (req, res): Promise<void> => {
    const id = parseId(req.params.id);
    if (!id || isNaN(id)) {
      res.status(400).json({ error: "Invalid job ID" });
      return;
    }
    try {
      const [job] = await db
        .select()
        .from(jobsTable)
        .where(eq(jobsTable.id, id));
      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }
      const [reports, materials, photos] = await Promise.all([
        db
          .select()
          .from(dailyReportsTable)
          .where(eq(dailyReportsTable.jobId, id))
          .orderBy(dailyReportsTable.date),
        db
          .select()
          .from(jobMaterialsTable)
          .where(eq(jobMaterialsTable.jobId, id))
          .orderBy(jobMaterialsTable.id),
        db
          .select()
          .from(jobPhotosTable)
          .where(eq(jobPhotosTable.jobId, id))
          .orderBy(jobPhotosTable.createdAt),
      ]);

      const userIds = [
        ...new Set(reports.map((r) => r.userId).filter((u): u is number => u != null)),
      ];
      const userMap = await buildUserMap(userIds);

      generateCompletionPDF(job, reports, materials, photos, userMap, res);
    } catch (err) {
      req.log?.error({ err }, "PDF completion pack generation failed");
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to generate PDF" });
      }
    }
  }
);

router.get(
  "/jobs/:id/pdf/photos",
  requireAuth,
  async (req, res): Promise<void> => {
    const id = parseId(req.params.id);
    if (!id || isNaN(id)) { res.status(400).json({ error: "Invalid job ID" }); return; }
    try {
      const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, id));
      if (!job) { res.status(404).json({ error: "Job not found" }); return; }

      const [jobPhotos, reports] = await Promise.all([
        db.select().from(jobPhotosTable).where(eq(jobPhotosTable.jobId, id)).orderBy(jobPhotosTable.createdAt),
        db.select().from(dailyReportsTable).where(eq(dailyReportsTable.jobId, id)).orderBy(dailyReportsTable.date),
      ]);

      const reportPhotos: { uri: string; date: string; label: string }[] = [];
      for (const r of reports) {
        const uris: string[] = (r as any).photoUris ?? [];
        uris.forEach((uri, idx) => {
          reportPhotos.push({ uri, date: r.date, label: `Report ${r.date} — Photo ${idx + 1}` });
        });
      }

      generatePhotosPDF(
        job,
        jobPhotos.map(p => ({ uri: p.uri, caption: p.caption ?? null, createdAt: p.createdAt.toISOString() })),
        reportPhotos,
        res
      );
    } catch (err) {
      req.log?.error({ err }, "PDF photos generation failed");
      if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF" });
    }
  }
);

export default router;
