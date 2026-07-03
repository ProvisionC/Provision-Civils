import { Router, type IRouter } from "express";
import { db, clientsTable } from "@workspace/db";
import { eq, and, ilike, isNull } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(s, 10);
}

function formatClient(c: typeof clientsTable.$inferSelect) {
  return {
    id: c.id,
    companyName: c.companyName,
    contactPerson: c.contactPerson ?? null,
    phone: c.phone ?? null,
    email: c.email ?? null,
    address: c.address ?? null,
    vatNumber: c.vatNumber ?? null,
    notes: c.notes ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

router.get("/clients", requireAuth, async (req, res): Promise<void> => {
  const { search } = req.query as { search?: string };
  const rows = await db.select().from(clientsTable)
    .where(and(
      isNull(clientsTable.deletedAt),
      search ? ilike(clientsTable.companyName, `%${search}%`) : undefined,
    ))
    .orderBy(clientsTable.companyName);
  res.json(rows.map(formatClient));
});

router.post("/clients", requireAuth, async (req, res): Promise<void> => {
  const { companyName, contactPerson, phone, email, address, vatNumber, notes } = req.body;
  if (!companyName?.trim()) {
    res.status(400).json({ error: "companyName is required" });
    return;
  }
  const [row] = await db.insert(clientsTable).values({
    companyName: companyName.trim(),
    contactPerson: contactPerson || null,
    phone: phone || null,
    email: email || null,
    address: address || null,
    vatNumber: vatNumber || null,
    notes: notes || null,
  }).returning();
  res.status(201).json(formatClient(row));
});

router.get("/clients/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [row] = await db.select().from(clientsTable).where(eq(clientsTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatClient(row));
});

router.put("/clients/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const { companyName, contactPerson, phone, email, address, vatNumber, notes } = req.body;
  if (!companyName?.trim()) {
    res.status(400).json({ error: "companyName is required" });
    return;
  }
  const [row] = await db.update(clientsTable).set({
    companyName: companyName.trim(),
    contactPerson: contactPerson || null,
    phone: phone || null,
    email: email || null,
    address: address || null,
    vatNumber: vatNumber || null,
    notes: notes || null,
  }).where(eq(clientsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatClient(row));
});

router.delete("/clients/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [existing] = await db.select({ id: clientsTable.id }).from(clientsTable).where(eq(clientsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  await db.update(clientsTable).set({ deletedAt: new Date() }).where(eq(clientsTable.id, id));
  res.status(204).send();
});

export default router;
