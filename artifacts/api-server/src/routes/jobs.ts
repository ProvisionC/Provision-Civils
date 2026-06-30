import { Router, type IRouter } from "express";
import { db, jobsTable, usersTable, jobWorkersTable, jobMaterialsTable, jobEquipmentTable, jobPhotosTable, gpsLogsTable, dailyReportsTable, expensesTable, invoicesTable, notificationsTable } from "@workspace/db";
import { eq, and, ilike, inArray, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const archiverLib = require("archiver") as typeof import("archiver");

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(s, 10);
}

async function getJobWithRelations(jobId: number) {
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!job) return null;

  const workerLinks = await db.select().from(jobWorkersTable).where(eq(jobWorkersTable.jobId, jobId));
  const workerIds = workerLinks.map(w => w.workerId);
  const workers = workerIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, workerIds))
    : [];

  const materials = await db.select().from(jobMaterialsTable).where(eq(jobMaterialsTable.jobId, jobId)).orderBy(jobMaterialsTable.id);
  const equipment = await db.select().from(jobEquipmentTable).where(eq(jobEquipmentTable.jobId, jobId));

  return { ...job, workers, materials, equipment };
}

function formatJob(job: typeof jobsTable.$inferSelect) {
  const j = job as typeof jobsTable.$inferSelect & {
    clientId?: number | null;
    projectName?: string | null;
    projectNumber?: string | null;
    projectManagerId?: number | null;
    poNumber?: string | null;
    clientOrderNumber?: string | null;
    contractValue?: string | null;
    startDate?: string | null;
    wayleaveRequired?: boolean;
    wayleaveDocument?: string | null;
  };
  return {
    id: job.id,
    jobNumber: job.jobNumber,
    clientId: j.clientId ?? null,
    clientName: job.clientName,
    clientPhone: job.clientPhone ?? null,
    clientEmail: job.clientEmail ?? null,
    projectName: j.projectName ?? null,
    projectNumber: j.projectNumber ?? null,
    projectManagerId: j.projectManagerId ?? null,
    poNumber: j.poNumber ?? null,
    clientOrderNumber: j.clientOrderNumber ?? null,
    contractValue: j.contractValue != null ? Number(j.contractValue) : null,
    siteAddress: job.siteAddress ?? null,
    gpsLat: job.gpsLat != null ? Number(job.gpsLat) : null,
    gpsLng: job.gpsLng != null ? Number(job.gpsLng) : null,
    description: job.description ?? null,
    notes: job.notes ?? null,
    labourHours: job.labourHours != null ? Number(job.labourHours) : null,
    status: job.status,
    supervisorId: job.supervisorId ?? null,
    startDate: j.startDate ?? null,
    dueDate: job.dueDate ?? null,
    wayleaveRequired: j.wayleaveRequired ?? false,
    wayleaveDocument: j.wayleaveDocument ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

async function generateJobNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const [result] = await db.select({ count: sql<number>`count(*)` }).from(jobsTable);
  const seq = (Number(result?.count ?? 0) + 1).toString().padStart(4, "0");
  return `JOB-${year}-${seq}`;
}

async function notifyWorkers(workerIds: number[], message: string, type: string, jobId: number) {
  const { notificationsTable } = await import("@workspace/db");
  for (const wid of workerIds) {
    await db.insert(notificationsTable).values({
      userId: wid,
      message,
      type: type as "job_assigned" | "job_updated" | "job_completed" | "invoice_created",
      jobId,
    });
  }
}

router.get("/jobs", requireAuth, async (req, res): Promise<void> => {
  const { status, search } = req.query as { status?: string; search?: string };

  let query = db.select().from(jobsTable).orderBy(jobsTable.createdAt);
  const jobs = await db.select().from(jobsTable)
    .where(
      and(
        status ? eq(jobsTable.status, status as typeof jobsTable.$inferSelect["status"]) : undefined,
        search ? ilike(jobsTable.clientName, `%${search}%`) : undefined,
      )
    )
    .orderBy(jobsTable.createdAt);

  res.json(jobs.map(formatJob));
});

router.post("/jobs", requireAuth, async (req, res): Promise<void> => {
  const { workerIds, materials, equipment, ...jobData } = req.body as {
    clientId?: number;
    clientName: string;
    clientPhone?: string;
    clientEmail?: string;
    projectName?: string;
    projectNumber?: string;
    projectManagerId?: number;
    poNumber?: string;
    clientOrderNumber?: string;
    contractValue?: number;
    siteAddress?: string;
    gpsLat?: number;
    gpsLng?: number;
    description?: string;
    notes?: string;
    labourHours?: number;
    supervisorId?: number;
    startDate?: string;
    dueDate?: string;
    status?: string;
    wayleaveRequired?: boolean;
    workerIds?: number[];
    materials?: { name: string; quantity: number; unit: string; cost?: number; checked?: boolean; notes?: string | null; isCustom?: boolean }[];
    equipment?: { name: string; quantity: number; cost?: number }[];
  };

  if (!jobData.clientName) {
    res.status(400).json({ error: "Client name required" });
    return;
  }

  const jobNumber = await generateJobNumber();
  const [job] = await db.insert(jobsTable).values({
    jobNumber,
    clientId: jobData.clientId,
    clientName: jobData.clientName,
    clientPhone: jobData.clientPhone,
    clientEmail: jobData.clientEmail,
    projectName: jobData.projectName,
    projectNumber: jobData.projectNumber,
    projectManagerId: jobData.projectManagerId,
    poNumber: jobData.poNumber,
    clientOrderNumber: jobData.clientOrderNumber,
    contractValue: jobData.contractValue?.toString(),
    siteAddress: jobData.siteAddress,
    gpsLat: jobData.gpsLat?.toString(),
    gpsLng: jobData.gpsLng?.toString(),
    description: jobData.description,
    notes: jobData.notes,
    labourHours: jobData.labourHours?.toString(),
    supervisorId: jobData.supervisorId,
    startDate: jobData.startDate,
    dueDate: jobData.dueDate,
    status: (jobData.status as typeof jobsTable.$inferSelect["status"]) ?? "active",
    wayleaveRequired: jobData.wayleaveRequired ?? false,
  } as any).returning();

  if (workerIds?.length) {
    await db.insert(jobWorkersTable).values(workerIds.map(id => ({ jobId: job.id, workerId: id })));
    await notifyWorkers(workerIds, `You have been assigned to job ${jobNumber}`, "job_assigned", job.id);
  }

  if (materials?.length) {
    await db.insert(jobMaterialsTable).values(materials.map(m => ({
      jobId: job.id,
      name: m.name,
      quantity: m.quantity.toString(),
      unit: m.unit,
      cost: m.cost?.toString(),
      checked: m.checked ?? false,
      notes: m.notes ?? null,
      isCustom: m.isCustom ?? false,
    })));
  }

  if (equipment?.length) {
    await db.insert(jobEquipmentTable).values(equipment.map(e => ({
      jobId: job.id,
      name: e.name,
      quantity: e.quantity.toString(),
      cost: e.cost?.toString(),
    })));
  }

  res.status(201).json(formatJob(job));
});

router.get("/jobs/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const detail = await getJobWithRelations(id);
  if (!detail) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  const { workers, materials, equipment, ...job } = detail;
  res.json({
    ...formatJob(job),
    workers: workers.map(w => ({
      id: w.id, name: w.name, email: w.email, role: w.role,
      phone: w.phone ?? null, createdAt: w.createdAt.toISOString(),
    })),
    materials: materials.map(m => ({
      id: m.id, jobId: m.jobId, name: m.name,
      quantity: Number(m.quantity), unit: m.unit, cost: m.cost != null ? Number(m.cost) : null,
      checked: m.checked, notes: m.notes ?? null, isCustom: m.isCustom,
    })),
    equipment: equipment.map(e => ({
      id: e.id, jobId: e.jobId, name: e.name,
      quantity: Number(e.quantity), cost: e.cost != null ? Number(e.cost) : null,
    })),
  });
});

router.put("/jobs/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const { workerIds, materials, equipment, ...jobData } = req.body as {
    clientId?: number;
    clientName?: string;
    clientPhone?: string;
    clientEmail?: string;
    projectName?: string;
    projectNumber?: string;
    projectManagerId?: number;
    poNumber?: string;
    clientOrderNumber?: string;
    contractValue?: number;
    siteAddress?: string;
    gpsLat?: number;
    gpsLng?: number;
    description?: string;
    notes?: string;
    labourHours?: number;
    status?: typeof jobsTable.$inferSelect["status"];
    supervisorId?: number;
    startDate?: string;
    dueDate?: string;
    wayleaveRequired?: boolean;
    wayleaveDocument?: string;
    workerIds?: number[];
    materials?: { name: string; quantity: number; unit: string; cost?: number; checked?: boolean; notes?: string | null; isCustom?: boolean }[];
    equipment?: { name: string; quantity: number; cost?: number }[];
  };

  const [existing] = await db.select().from(jobsTable).where(eq(jobsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const [job] = await db.update(jobsTable).set({
    ...(jobData.clientId !== undefined && { clientId: jobData.clientId }),
    ...(jobData.clientName && { clientName: jobData.clientName }),
    ...(jobData.clientPhone !== undefined && { clientPhone: jobData.clientPhone }),
    ...(jobData.clientEmail !== undefined && { clientEmail: jobData.clientEmail }),
    ...(jobData.projectName !== undefined && { projectName: jobData.projectName }),
    ...(jobData.projectNumber !== undefined && { projectNumber: jobData.projectNumber }),
    ...(jobData.projectManagerId !== undefined && { projectManagerId: jobData.projectManagerId }),
    ...(jobData.poNumber !== undefined && { poNumber: jobData.poNumber }),
    ...(jobData.clientOrderNumber !== undefined && { clientOrderNumber: jobData.clientOrderNumber }),
    ...(jobData.contractValue !== undefined && { contractValue: jobData.contractValue?.toString() }),
    ...(jobData.siteAddress !== undefined && { siteAddress: jobData.siteAddress }),
    ...(jobData.gpsLat !== undefined && { gpsLat: jobData.gpsLat?.toString() }),
    ...(jobData.gpsLng !== undefined && { gpsLng: jobData.gpsLng?.toString() }),
    ...(jobData.description !== undefined && { description: jobData.description }),
    ...(jobData.notes !== undefined && { notes: jobData.notes }),
    ...(jobData.labourHours !== undefined && { labourHours: jobData.labourHours?.toString() }),
    ...(jobData.status && { status: jobData.status }),
    ...(jobData.supervisorId !== undefined && { supervisorId: jobData.supervisorId }),
    ...(jobData.startDate !== undefined && { startDate: jobData.startDate }),
    ...(jobData.dueDate !== undefined && { dueDate: jobData.dueDate }),
    ...(jobData.wayleaveRequired !== undefined && { wayleaveRequired: jobData.wayleaveRequired }),
    ...(jobData.wayleaveDocument !== undefined && { wayleaveDocument: jobData.wayleaveDocument }),
  } as any).where(eq(jobsTable.id, id)).returning();

  if (workerIds !== undefined) {
    await db.delete(jobWorkersTable).where(eq(jobWorkersTable.jobId, id));
    if (workerIds.length > 0) {
      await db.insert(jobWorkersTable).values(workerIds.map(wid => ({ jobId: id, workerId: wid })));
      await notifyWorkers(workerIds, `Job ${existing.jobNumber} has been updated`, "job_updated", id);
    }
  }

  if (materials !== undefined) {
    await db.delete(jobMaterialsTable).where(eq(jobMaterialsTable.jobId, id));
    if (materials.length > 0) {
      await db.insert(jobMaterialsTable).values(materials.map(m => ({
        jobId: id, name: m.name, quantity: m.quantity.toString(),
        unit: m.unit, cost: m.cost?.toString(),
        checked: m.checked ?? false, notes: m.notes ?? null, isCustom: m.isCustom ?? false,
      })));
    }
  }

  if (equipment !== undefined) {
    await db.delete(jobEquipmentTable).where(eq(jobEquipmentTable.jobId, id));
    if (equipment.length > 0) {
      await db.insert(jobEquipmentTable).values(equipment.map(e => ({
        jobId: id, name: e.name, quantity: e.quantity.toString(), cost: e.cost?.toString(),
      })));
    }
  }

  if (jobData.status === "completed") {
    const workerLinks = await db.select().from(jobWorkersTable).where(eq(jobWorkersTable.jobId, id));
    await notifyWorkers(workerLinks.map(w => w.workerId), `Job ${existing.jobNumber} is now completed`, "job_completed", id);
  }

  res.json(formatJob(job));
});

router.delete("/jobs/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  // Verify job exists first
  const [existing] = await db.select({ id: jobsTable.id }).from(jobsTable).where(eq(jobsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  // Explicitly remove all child records (belt-and-suspenders alongside DB cascade FKs)
  await db.delete(notificationsTable).where(eq(notificationsTable.jobId, id));
  await db.delete(expensesTable).where(eq(expensesTable.jobId, id));
  await db.delete(invoicesTable).where(eq(invoicesTable.jobId, id));
  await db.delete(jobPhotosTable).where(eq(jobPhotosTable.jobId, id));
  await db.delete(gpsLogsTable).where(eq(gpsLogsTable.jobId, id));
  await db.delete(dailyReportsTable).where(eq(dailyReportsTable.jobId, id));
  await db.delete(jobMaterialsTable).where(eq(jobMaterialsTable.jobId, id));
  await db.delete(jobEquipmentTable).where(eq(jobEquipmentTable.jobId, id));
  await db.delete(jobWorkersTable).where(eq(jobWorkersTable.jobId, id));
  await db.delete(jobsTable).where(eq(jobsTable.id, id));
  res.sendStatus(204);
});

router.get("/jobs/:id/photos", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const photos = await db.select().from(jobPhotosTable).where(eq(jobPhotosTable.jobId, id));
  res.json(photos.map(p => ({
    id: p.id, jobId: p.jobId, uri: p.uri,
    caption: p.caption ?? null, uploadedById: p.uploadedById ?? null,
    createdAt: p.createdAt.toISOString(),
  })));
});

router.post("/jobs/:id/photos", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const auth = (req as typeof req & { auth: { userId: number } }).auth;
  const { uri, caption } = req.body as { uri: string; caption?: string };
  if (!uri) {
    res.status(400).json({ error: "Photo URI required" });
    return;
  }
  const [photo] = await db.insert(jobPhotosTable).values({
    jobId: id, uri, caption, uploadedById: auth.userId,
  }).returning();
  res.status(201).json({
    id: photo.id, jobId: photo.jobId, uri: photo.uri,
    caption: photo.caption ?? null, uploadedById: photo.uploadedById ?? null,
    createdAt: photo.createdAt.toISOString(),
  });
});

router.put("/jobs/:id/materials", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const materials = req.body as { name: string; quantity: number; unit: string; cost?: number | null; checked?: boolean; notes?: string | null; isCustom?: boolean }[];

  if (!Array.isArray(materials)) {
    res.status(400).json({ error: "Expected an array of materials" });
    return;
  }

  await db.delete(jobMaterialsTable).where(eq(jobMaterialsTable.jobId, id));

  if (materials.length > 0) {
    await db.insert(jobMaterialsTable).values(materials.map(m => ({
      jobId: id,
      name: m.name,
      quantity: (m.quantity ?? 0).toString(),
      unit: m.unit ?? "units",
      cost: m.cost != null ? m.cost.toString() : null,
      checked: m.checked ?? false,
      notes: m.notes ?? null,
      isCustom: m.isCustom ?? false,
    })));
  }

  const updated = await db.select().from(jobMaterialsTable).where(eq(jobMaterialsTable.jobId, id)).orderBy(jobMaterialsTable.id);
  res.json(updated.map(m => ({
    id: m.id, jobId: m.jobId, name: m.name,
    quantity: Number(m.quantity), unit: m.unit, cost: m.cost != null ? Number(m.cost) : null,
    checked: m.checked, notes: m.notes ?? null, isCustom: m.isCustom,
  })));
});

router.get("/jobs/:id/photos/zip", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  try {
    const [jobRow] = await db.select().from(jobsTable).where(eq(jobsTable.id, id));
    if (!jobRow) { res.status(404).json({ error: "Job not found" }); return; }

    const [jobPhotos, reports] = await Promise.all([
      db.select().from(jobPhotosTable).where(eq(jobPhotosTable.jobId, id)),
      db.select().from(dailyReportsTable).where(eq(dailyReportsTable.jobId, id)).orderBy(dailyReportsTable.date),
    ]);

    function b64Buf(uri: string): Buffer | null {
      if (!uri?.startsWith("data:")) return null;
      const idx = uri.indexOf(",");
      if (idx < 0) return null;
      try { return Buffer.from(uri.slice(idx + 1), "base64"); } catch { return null; }
    }

    const projectName = jobRow.projectName ?? jobRow.clientName ?? "Project";
    const safeProject = projectName.replace(/[/\\:*?"<>|]/g, "-").trim() || "Project";
    const folderRoot = `${jobRow.jobNumber ?? "JOB"} - ${safeProject}`;

    const allPhotos: { buf: Buffer; name: string }[] = [];
    jobPhotos.forEach((p, i) => {
      const buf = b64Buf(p.uri);
      if (buf) allPhotos.push({ buf, name: `${folderRoot}/General Photos/photo-${String(i + 1).padStart(3, "0")}.jpg` });
    });
    reports.forEach(r => {
      const uris: string[] = (r as any).photoUris ?? [];
      uris.forEach((uri, i) => {
        const buf = b64Buf(uri);
        if (buf) allPhotos.push({ buf, name: `${folderRoot}/Daily Reports/report-${r.date}-${String(i + 1).padStart(2, "0")}.jpg` });
      });
    });

    if (allPhotos.length === 0) {
      res.status(404).json({ error: "No photos found for this job" });
      return;
    }

    const jobNumber = jobRow.jobNumber ?? "JOB";
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${jobNumber}-Photos.zip"`);
    res.setHeader("Cache-Control", "no-cache");

    const archive = archiverLib("zip", { zlib: { level: 6 } });
    archive.on("error", (err: Error) => { req.log?.error({ err }, "ZIP error"); });
    archive.pipe(res);
    for (const { buf, name } of allPhotos) {
      archive.append(buf, { name });
    }
    await archive.finalize();
  } catch (err) {
    req.log?.error({ err }, "ZIP photos failed");
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate ZIP" });
  }
});

router.delete("/jobs/:id/photos/:photoId", requireAuth, async (req, res): Promise<void> => {
  const photoId = parseId(req.params.photoId);
  const [deleted] = await db.delete(jobPhotosTable).where(eq(jobPhotosTable.id, photoId)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/jobs/:id/gps-logs", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const logs = await db.select().from(gpsLogsTable).where(eq(gpsLogsTable.jobId, id));
  res.json(logs.map(l => ({
    id: l.id, jobId: l.jobId, userId: l.userId,
    arrivalLat: Number(l.arrivalLat), arrivalLng: Number(l.arrivalLng),
    arrivalTime: l.arrivalTime.toISOString(),
    departureLat: l.departureLat != null ? Number(l.departureLat) : null,
    departureLng: l.departureLng != null ? Number(l.departureLng) : null,
    departureTime: l.departureTime?.toISOString() ?? null,
  })));
});

router.post("/jobs/:id/gps-logs", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const auth = (req as typeof req & { auth: { userId: number } }).auth;
  const { arrivalLat, arrivalLng, arrivalTime, departureLat, departureLng, departureTime } = req.body as {
    arrivalLat: number; arrivalLng: number; arrivalTime: string;
    departureLat?: number; departureLng?: number; departureTime?: string;
  };
  const [log] = await db.insert(gpsLogsTable).values({
    jobId: id,
    userId: auth.userId,
    arrivalLat: arrivalLat.toString(),
    arrivalLng: arrivalLng.toString(),
    arrivalTime: new Date(arrivalTime),
    departureLat: departureLat?.toString(),
    departureLng: departureLng?.toString(),
    departureTime: departureTime ? new Date(departureTime) : undefined,
  }).returning();
  res.status(201).json({
    id: log.id, jobId: log.jobId, userId: log.userId,
    arrivalLat: Number(log.arrivalLat), arrivalLng: Number(log.arrivalLng),
    arrivalTime: log.arrivalTime.toISOString(),
    departureLat: log.departureLat != null ? Number(log.departureLat) : null,
    departureLng: log.departureLng != null ? Number(log.departureLng) : null,
    departureTime: log.departureTime?.toISOString() ?? null,
  });
});

router.get("/jobs/:id/daily-reports", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const reports = await db.select().from(dailyReportsTable).where(eq(dailyReportsTable.jobId, id)).orderBy(dailyReportsTable.date);
  res.json(reports.map(r => {
    const rr = r as any;
    return {
      id: r.id, jobId: r.jobId, userId: r.userId, date: r.date,
      workCompleted: rr.workCompleted ?? null,
      problemsEncountered: rr.problemsEncountered ?? null,
      tomorrowWork: rr.tomorrowWork ?? null,
      labourOnSite: rr.labourOnSite ?? null,
      gpsLat: rr.gpsLat != null ? Number(rr.gpsLat) : null,
      gpsLng: rr.gpsLng != null ? Number(rr.gpsLng) : null,
      signatureUri: rr.signatureUri ?? null,
      notes: r.notes ?? null, progressNotes: r.progressNotes ?? null,
      photoUris: r.photoUris ?? [],
      createdAt: r.createdAt.toISOString(),
    };
  }));
});

router.post("/jobs/:id/daily-reports", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const auth = (req as typeof req & { auth: { userId: number } }).auth;
  const { date, notes, progressNotes, photoUris, workCompleted, problemsEncountered, tomorrowWork, labourOnSite, gpsLat, gpsLng, signatureUri } = req.body as {
    date: string; notes?: string; progressNotes?: string; photoUris?: string[];
    workCompleted?: string; problemsEncountered?: string; tomorrowWork?: string;
    labourOnSite?: string; gpsLat?: number; gpsLng?: number; signatureUri?: string;
  };
  const [report] = await db.insert(dailyReportsTable).values({
    jobId: id, userId: auth.userId, date,
    notes, progressNotes, photoUris: photoUris ?? [],
    workCompleted, problemsEncountered, tomorrowWork, labourOnSite,
    gpsLat: gpsLat?.toString(), gpsLng: gpsLng?.toString(), signatureUri,
  } as any).returning();
  const rr = report as any;
  res.status(201).json({
    id: report.id, jobId: report.jobId, userId: report.userId, date: report.date,
    workCompleted: rr.workCompleted ?? null,
    problemsEncountered: rr.problemsEncountered ?? null,
    tomorrowWork: rr.tomorrowWork ?? null,
    labourOnSite: rr.labourOnSite ?? null,
    gpsLat: rr.gpsLat != null ? Number(rr.gpsLat) : null,
    gpsLng: rr.gpsLng != null ? Number(rr.gpsLng) : null,
    signatureUri: rr.signatureUri ?? null,
    notes: report.notes ?? null, progressNotes: report.progressNotes ?? null,
    photoUris: report.photoUris ?? [],
    createdAt: report.createdAt.toISOString(),
  });
});

export default router;
