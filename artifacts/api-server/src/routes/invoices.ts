import { Router, type IRouter } from "express";
import { db, invoicesTable, jobsTable, notificationsTable, jobWorkersTable } from "@workspace/db";
import { eq, inArray, isNull } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(s, 10);
}

async function generateInvoiceNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const [result] = await db.select({ count: sql<number>`count(*)` }).from(invoicesTable);
  const seq = (Number(result?.count ?? 0) + 1).toString().padStart(4, "0");
  return `INV-${year}${month}-${seq}`;
}

function formatInvoice(inv: typeof invoicesTable.$inferSelect, job?: typeof jobsTable.$inferSelect) {
  const base = {
    id: inv.id,
    jobId: inv.jobId,
    invoiceNumber: inv.invoiceNumber,
    labourCost: Number(inv.labourCost),
    materialsCost: Number(inv.materialsCost),
    equipmentCost: Number(inv.equipmentCost),
    vat: Number(inv.vat),
    total: Number(inv.total),
    status: inv.status,
    notes: inv.notes ?? null,
    createdAt: inv.createdAt.toISOString(),
  };
  if (job) {
    return {
      ...base,
      job: {
        id: job.id, jobNumber: job.jobNumber, clientName: job.clientName,
        clientPhone: job.clientPhone ?? null, clientEmail: job.clientEmail ?? null,
        siteAddress: job.siteAddress ?? null, gpsLat: null, gpsLng: null,
        description: job.description ?? null, notes: job.notes ?? null,
        labourHours: null, status: job.status, supervisorId: job.supervisorId ?? null,
        dueDate: job.dueDate ?? null,
        createdAt: job.createdAt.toISOString(), updatedAt: job.updatedAt.toISOString(),
      },
    };
  }
  return base;
}

router.get("/invoices", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .select({ inv: invoicesTable, job: jobsTable })
    .from(invoicesTable)
    .leftJoin(jobsTable, eq(invoicesTable.jobId, jobsTable.id))
    .where(isNull(invoicesTable.deletedAt))
    .orderBy(invoicesTable.createdAt);
  res.json(rows.map(r => formatInvoice(r.inv, r.job ?? undefined)));
});

router.post("/invoices", requireAuth, async (req, res): Promise<void> => {
  const { jobId, labourCost, materialsCost, equipmentCost, vat, notes } = req.body as {
    jobId: number; labourCost: number; materialsCost: number; equipmentCost: number; vat: number; notes?: string;
  };
  if (!jobId || labourCost == null || materialsCost == null || equipmentCost == null || vat == null) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const subtotal = labourCost + materialsCost + equipmentCost;
  const vatAmount = subtotal * (vat / 100);
  const total = subtotal + vatAmount;
  const invoiceNumber = await generateInvoiceNumber();

  const [inv] = await db.insert(invoicesTable).values({
    jobId, invoiceNumber,
    labourCost: labourCost.toString(),
    materialsCost: materialsCost.toString(),
    equipmentCost: equipmentCost.toString(),
    vat: vat.toString(),
    total: total.toString(),
    notes,
  }).returning();

  const workerLinks = await db.select().from(jobWorkersTable).where(eq(jobWorkersTable.jobId, jobId));
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  const jobNumber = job?.jobNumber ?? `#${jobId}`;

  for (const link of workerLinks) {
    await db.insert(notificationsTable).values({
      userId: link.workerId,
      message: `Invoice ${invoiceNumber} created for job ${jobNumber}`,
      type: "invoice_created",
      jobId,
    });
  }

  const [fullJob] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  res.status(201).json(formatInvoice(inv, fullJob));
});

router.get("/invoices/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!inv) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, inv.jobId));
  res.json(formatInvoice(inv, job));
});

router.put("/invoices/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const { status, notes, labourCost, materialsCost, equipmentCost, vat } = req.body as {
    status?: string; notes?: string; labourCost?: number; materialsCost?: number; equipmentCost?: number; vat?: number;
  };

  const [existing] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  const newLabour = labourCost ?? Number(existing.labourCost);
  const newMaterials = materialsCost ?? Number(existing.materialsCost);
  const newEquipment = equipmentCost ?? Number(existing.equipmentCost);
  const newVat = vat ?? Number(existing.vat);
  const subtotal = newLabour + newMaterials + newEquipment;
  const total = subtotal + subtotal * (newVat / 100);

  const [inv] = await db.update(invoicesTable).set({
    ...(status && { status: status as typeof invoicesTable.$inferSelect["status"] }),
    ...(notes !== undefined && { notes }),
    labourCost: newLabour.toString(),
    materialsCost: newMaterials.toString(),
    equipmentCost: newEquipment.toString(),
    vat: newVat.toString(),
    total: total.toString(),
  }).where(eq(invoicesTable.id, id)).returning();

  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, inv.jobId));
  res.json(formatInvoice(inv, job));
});

export default router;
