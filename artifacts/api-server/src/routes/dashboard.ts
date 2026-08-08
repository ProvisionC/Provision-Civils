import { Router, type IRouter } from "express";
import { db, jobsTable, usersTable, invoicesTable, expensesTable } from "@workspace/db";
import { count, sql, sum, isNull, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/dashboard/stats", requireAuth, async (req, res): Promise<void> => {
  const auth = (req as any).auth as { userId: number; role: string } | undefined;
  const today = new Date().toISOString().split("T")[0];

  // Combine core stats, employees count, and invoices count into one query or parallelize if possible.
  // Using Promise.all for parallel execution of independent queries.
  const [statsResult, employeesResult, invoicesResult] = await Promise.all([
    db.select({
      activeJobs: count(sql`CASE WHEN status IN ('active', 'in_progress', 'pending') THEN 1 END`),
      completedJobs: count(sql`CASE WHEN status = 'completed' THEN 1 END`),
      overdueJobs: count(sql`CASE WHEN status NOT IN ('completed', 'cancelled') AND due_date < ${today} THEN 1 END`),
      jobsDueToday: count(sql`CASE WHEN status NOT IN ('completed', 'cancelled') AND due_date = ${today} THEN 1 END`),
      pendingWayleave: count(sql`CASE WHEN status = 'waiting_for_wayleave' THEN 1 END`),
    })
    .from(jobsTable)
    .where(isNull(jobsTable.deletedAt)),
    db.select({ count: count() }).from(usersTable),
    db.select({ count: count() }).from(invoicesTable),
  ]);

  const [statsData] = statsResult;

  const stats: Record<string, number | null> = {
    activeJobs: Number(statsData?.activeJobs ?? 0),
    completedJobs: Number(statsData?.completedJobs ?? 0),
    overdueJobs: Number(statsData?.overdueJobs ?? 0),
    jobsDueToday: Number(statsData?.jobsDueToday ?? 0),
    totalEmployees: Number(employeesResult[0]?.count ?? 0),
    totalInvoices: Number(invoicesResult[0]?.count ?? 0),
    pendingWayleave: Number(statsData?.pendingWayleave ?? 0),
  };

  if (auth?.role === "admin") {
    // Financial calculations: can be parallelized too
    const [contractVal, expenses, invoiced] = await Promise.all([
      db.select({ total: sum(sql`CAST(${jobsTable.contractValue} AS NUMERIC)`) }).from(jobsTable).where(sql`${jobsTable.contractValue} IS NOT NULL`),
      db.select({ total: sum(sql`CAST(${expensesTable.amount} AS NUMERIC)`) }).from(expensesTable).innerJoin(jobsTable, eq(expensesTable.jobId, jobsTable.id)).where(isNull(jobsTable.deletedAt)),
      db.select({ total: sum(sql`CAST(${invoicesTable.total} AS NUMERIC)`) }).from(invoicesTable).where(sql`${invoicesTable.status} IN ('sent', 'paid')`),
    ]);

    const contractValNum = Number(contractVal[0]?.total ?? 0);
    const expensesValNum = Number(expenses[0]?.total ?? 0);
    const invoicedValNum = Number(invoiced[0]?.total ?? 0);

    stats.totalContractValue = contractValNum;
    stats.totalExpenses = expensesValNum;
    stats.totalInvoiced = invoicedValNum;
    stats.estimatedProfit = invoicedValNum - expensesValNum;
  }

  res.json(stats);
});

export default router;
