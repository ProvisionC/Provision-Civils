import { Router, type IRouter } from "express";
import { db, labourEntriesTable, expensesTable, jobsTable, jobMaterialsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/jobs/:id/costing", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const jobId = parseInt(rawId, 10);
  if (isNaN(jobId)) { res.status(400).json({ error: "Invalid job id" }); return; }

  // Get job for revenue (contract value)
  const [job] = await db.select({ contractValue: jobsTable.contractValue, clientName: jobsTable.clientName })
    .from(jobsTable).where(eq(jobsTable.id, jobId)).limit(1);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }

  // Labour cost: sum amountPayable for complete piece_work + all hourly entries
  const [labourRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${labourEntriesTable.amountPayable}::numeric), 0)` })
    .from(labourEntriesTable)
    .where(
      and(
        eq(labourEntriesTable.jobId, jobId),
      )
    );

  // Recalculate correctly: piece_work only when complete, hourly always
  const labourRows = await db.select({
    payrollType: labourEntriesTable.payrollType,
    status: labourEntriesTable.status,
    amountPayable: labourEntriesTable.amountPayable,
  }).from(labourEntriesTable).where(eq(labourEntriesTable.jobId, jobId));

  const labourCost = labourRows.reduce((sum, r) => {
    if (r.payrollType === "hourly") return sum + (r.amountPayable ? Number(r.amountPayable) : 0);
    if (r.payrollType === "piece_work" && r.status === "complete") return sum + (r.amountPayable ? Number(r.amountPayable) : 0);
    return sum;
  }, 0);

  // Expenses by category
  const expenseRows = await db.select({
    category: expensesTable.category,
    total: sql<string>`SUM(${expensesTable.amount}::numeric)`,
  })
    .from(expensesTable)
    .where(eq(expensesTable.jobId, jobId))
    .groupBy(expensesTable.category);

  const expensesByCategory: Record<string, number> = {};
  let totalExpenses = 0;
  for (const row of expenseRows) {
    expensesByCategory[row.category] = Number(row.total);
    totalExpenses += Number(row.total);
  }

  // Materials cost from job_materials
  const [matRow] = await db.select({
    total: sql<string>`COALESCE(SUM(${jobMaterialsTable.cost}::numeric * ${jobMaterialsTable.quantity}::numeric), 0)`,
  }).from(jobMaterialsTable).where(eq(jobMaterialsTable.jobId, jobId));
  const materialsCost = Number(matRow?.total ?? 0);

  const revenue = job.contractValue ? Number(job.contractValue) : 0;
  const totalCost = labourCost + totalExpenses + materialsCost;
  const profitLoss = revenue - totalCost;

  res.json({
    jobId,
    labourCost,
    expensesByCategory,
    totalExpenses,
    materialsCost,
    totalCost,
    revenue,
    profitLoss,
  });
});

export default router;
