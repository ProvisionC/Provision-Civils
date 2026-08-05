import { Router, type IRouter } from "express";
import { db, jobsTable, usersTable, invoicesTable, expensesTable } from "@workspace/db";
import { count, and, sql, sum, isNull, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/dashboard/stats", requireAuth, async (req, res): Promise<void> => {
  const auth = (req as any).auth as { userId: number; role: string } | undefined;
  const today = new Date().toISOString().split("T")[0];

  const statsQuery = await db.select({
    activeJobs: count(sql`CASE WHEN status IN ('active', 'in_progress', 'pending') THEN 1 END`),
    completedJobs: count(sql`CASE WHEN status = 'completed' THEN 1 END`),
    overdueJobs: count(sql`CASE WHEN status NOT IN ('completed', 'cancelled') AND due_date < ${today} THEN 1 END`),
    jobsDueToday: count(sql`CASE WHEN status NOT IN ('completed', 'cancelled') AND due_date = ${today} THEN 1 END`),
    pendingWayleave: count(sql`CASE WHEN status = 'waiting_for_wayleave' THEN 1 END`),
  })
  .from(jobsTable)
  .where(isNull(jobsTable.deletedAt));

  const [statsResult] = statsQuery;

  const [employeesResult] = await db.select({ count: count() }).from(usersTable);
  const [invoicesResult] = await db.select({ count: count() }).from(invoicesTable);

  const stats: Record<string, number | null> = {
    activeJobs: Number(statsResult?.activeJobs ?? 0),
    completedJobs: Number(statsResult?.completedJobs ?? 0),
    overdueJobs: Number(statsResult?.overdueJobs ?? 0),
    jobsDueToday: Number(statsResult?.jobsDueToday ?? 0),
    totalEmployees: Number(employeesResult?.count ?? 0),
    totalInvoices: Number(invoicesResult?.count ?? 0),
    pendingWayleave: Number(statsResult?.pendingWayleave ?? 0),
  };

  if (auth?.role === "admin") {
    // ... admin financial calculations (keep existing)
    const [contractValueResult] = await db.select({ total: sum(sql`CAST(${jobsTable.contractValue} AS NUMERIC)`) }).from(jobsTable)
      .where(sql`${jobsTable.contractValue} IS NOT NULL`);
    const [expensesResult] = await db
      .select({
        total: sum(sql`CAST(${expensesTable.amount} AS NUMERIC)`),
      })
      .from(expensesTable)
      .innerJoin(jobsTable, eq(expensesTable.jobId, jobsTable.id))
      .where(isNull(jobsTable.deletedAt));
    const [invoicedResult] = await db.select({ total: sum(sql`CAST(${invoicesTable.total} AS NUMERIC)`) }).from(invoicesTable)
      .where(sql`${invoicesTable.status} IN ('sent', 'paid')`);

    const contractVal = Number(contractValueResult?.total ?? 0);
    const expensesVal = Number(expensesResult?.total ?? 0);
    const invoicedVal = Number(invoicedResult?.total ?? 0);

    stats.totalContractValue = contractVal;
    stats.totalExpenses = expensesVal;
    stats.totalInvoiced = invoicedVal;
    stats.estimatedProfit = invoicedVal - expensesVal;
  }

  res.json(stats);
});

export default router;
