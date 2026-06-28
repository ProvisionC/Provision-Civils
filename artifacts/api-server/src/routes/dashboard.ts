import { Router, type IRouter } from "express";
import { db, jobsTable, usersTable, invoicesTable } from "@workspace/db";
import { eq, count, and, lte, gte, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/dashboard/stats", requireAuth, async (_req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];

  const [activeResult] = await db.select({ count: count() }).from(jobsTable)
    .where(eq(jobsTable.status, "in_progress"));

  const [completedResult] = await db.select({ count: count() }).from(jobsTable)
    .where(eq(jobsTable.status, "completed"));

  const [overdueResult] = await db.select({ count: count() }).from(jobsTable)
    .where(and(
      sql`${jobsTable.dueDate} < ${today}`,
      sql`${jobsTable.status} NOT IN ('completed', 'cancelled')`
    ));

  const [dueTodayResult] = await db.select({ count: count() }).from(jobsTable)
    .where(and(
      eq(jobsTable.dueDate, today),
      sql`${jobsTable.status} NOT IN ('completed', 'cancelled')`
    ));

  const [employeesResult] = await db.select({ count: count() }).from(usersTable);

  const [invoicesResult] = await db.select({ count: count() }).from(invoicesTable);

  res.json({
    activeJobs: Number(activeResult?.count ?? 0),
    completedJobs: Number(completedResult?.count ?? 0),
    overdueJobs: Number(overdueResult?.count ?? 0),
    jobsDueToday: Number(dueTodayResult?.count ?? 0),
    totalEmployees: Number(employeesResult?.count ?? 0),
    totalInvoices: Number(invoicesResult?.count ?? 0),
  });
});

export default router;
