import { Router, type IRouter } from "express";
import { db, jobsTable, usersTable, invoicesTable, expensesTable } from "@workspace/db";
import { count, and, sql, sum, isNull } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/dashboard/stats", requireAuth, async (req, res): Promise<void> => {
  const auth = (req as any).auth as { userId: number; role: string } | undefined;
  const today = new Date().toISOString().split("T")[0];

 const [activeResult] = await db
  .select({ count: count() })
  .from(jobsTable)
  .where(
    and(
      isNull(jobsTable.deletedAt),
      sql`${jobsTable.status} IN ('active', 'in_progress', 'pending')`
    )
  );

  const [completedResult] = await db
  .select({ count: count() })
  .from(jobsTable)
  .where(
    and(
      isNull(jobsTable.deletedAt),
      sql`${jobsTable.status} = 'completed'`
    )
  );

  const [overdueResult] = await db
  .select({ count: count() })
  .from(jobsTable)
  .where(
    and(
      isNull(jobsTable.deletedAt),
      sql`${jobsTable.dueDate} < ${today}`,
      sql`${jobsTable.status} NOT IN ('completed', 'cancelled')`
    )
  );

  const [dueTodayResult] = await db
  .select({ count: count() })
  .from(jobsTable)
  .where(
    and(
      isNull(jobsTable.deletedAt),
      sql`${jobsTable.dueDate} = ${today}`,
      sql`${jobsTable.status} NOT IN ('completed', 'cancelled')`
    )
  );

  const [employeesResult] = await db.select({ count: count() }).from(usersTable);
  const [invoicesResult] = await db.select({ count: count() }).from(invoicesTable);
  const [wayleaveResult] = await db
  .select({ count: count() })
  .from(jobsTable)
  .where(
    and(
      isNull(jobsTable.deletedAt),
      sql`${jobsTable.status} = 'waiting_for_wayleave'`
    )
  );

  const stats: Record<string, number | null> = {
    activeJobs: Number(activeResult?.count ?? 0),
    completedJobs: Number(completedResult?.count ?? 0),
    overdueJobs: Number(overdueResult?.count ?? 0),
    jobsDueToday: Number(dueTodayResult?.count ?? 0),
    totalEmployees: Number(employeesResult?.count ?? 0),
    totalInvoices: Number(invoicesResult?.count ?? 0),
    pendingWayleave: Number(wayleaveResult?.count ?? 0),
  };

  if (auth?.role === "admin") {
    const [contractValueResult] = await db.select({ total: sum(sql`CAST(${jobsTable.contractValue} AS NUMERIC)`) }).from(jobsTable)
      .where(sql`${jobsTable.contractValue} IS NOT NULL`);
    const [expensesResult] = await db.select({ total: sum(sql`CAST(${expensesTable.amount} AS NUMERIC)`) }).from(expensesTable);
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

console.log("Dashboard Stats:", stats);


  res.json(stats);
});

export default router;
