import { Router, type IRouter } from "express";
import { db, expensesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(s, 10);
}

function formatExpense(e: typeof expensesTable.$inferSelect) {
  return {
    id: e.id,
    jobId: e.jobId,
    createdById: e.createdById,
    date: e.date,
    category: e.category,
    description: e.description,
    amount: Number(e.amount),
    receiptPhotoUri: e.receiptPhotoUri ?? null,
    createdAt: e.createdAt.toISOString(),
  };
}

router.get("/jobs/:id/expenses", requireAuth, async (req, res): Promise<void> => {
  const auth = (req as any).auth as { userId: number; role: string } | undefined;
  if (auth?.role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  const jobId = parseId(req.params.id);
  const rows = await db.select().from(expensesTable)
    .where(eq(expensesTable.jobId, jobId))
    .orderBy(expensesTable.date);
  res.json(rows.map(formatExpense));
});

router.post("/jobs/:id/expenses", requireAuth, async (req, res): Promise<void> => {
  const auth = (req as any).auth as { userId: number; role: string } | undefined;
  if (auth?.role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  const jobId = parseId(req.params.id);
  const { date, category, description, amount, receiptPhotoUri } = req.body;
  if (!date || !description || amount == null) {
    res.status(400).json({ error: "date, description, and amount are required" });
    return;
  }
  const [row] = await db.insert(expensesTable).values({
    jobId,
    createdById: auth.userId,
    date,
    category: category ?? "other",
    description,
    amount: String(amount),
    receiptPhotoUri: receiptPhotoUri || null,
  }).returning();
  res.status(201).json(formatExpense(row));
});

router.delete("/jobs/:id/expenses/:expenseId", requireAuth, async (req, res): Promise<void> => {
  const auth = (req as any).auth as { userId: number; role: string } | undefined;
  if (auth?.role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  const jobId = parseId(req.params.id);
  const expenseId = parseId(req.params.expenseId);
  await db.delete(expensesTable).where(
    and(eq(expensesTable.id, expenseId), eq(expensesTable.jobId, jobId))
  );
  res.status(204).send();
});

export default router;
