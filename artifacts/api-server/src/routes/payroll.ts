import { Router, type IRouter } from "express";
import { db, labourEntriesTable, usersTable, jobsTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import {
  generatePayrollSummaryPDF,
  generateEmployeePayrollPDF,
  generateJobPayrollCostPDF,
} from "../utils/pdf-generator.js";
import type { Request } from "express";

interface AuthReq extends Request { auth: { userId: number; role: string } }

const router: IRouter = Router();

// Only count piece_work rows that are marked complete; hourly always counts
function payrollFilter() {
  return sql`(
    ${labourEntriesTable.payrollType} = 'hourly'
    OR (${labourEntriesTable.payrollType} = 'piece_work' AND ${labourEntriesTable.status} = 'complete')
  )`;
}

// ── GET /payroll/summary ──────────────────────────────────────────────────────
router.get("/payroll/summary", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const r = req as AuthReq;
  const { startDate, endDate, employeeId, jobId } = req.query as Record<string, string | undefined>;

  const conds: any[] = [payrollFilter()];
  if (startDate)  conds.push(gte(labourEntriesTable.date, startDate));
  if (endDate)    conds.push(lte(labourEntriesTable.date, endDate));
  if (employeeId) conds.push(eq(labourEntriesTable.employeeId, parseInt(employeeId, 10)));
  if (jobId)      conds.push(eq(labourEntriesTable.jobId, parseInt(jobId, 10)));

  const rows = await db
    .select({
      employeeId:   usersTable.id,
      employeeName: usersTable.name,
      employeeNumber: usersTable.employeeNumber,
      clockNumber:  usersTable.clockNumber,

      totalHours:   sql<string>`COALESCE(SUM(CASE WHEN ${labourEntriesTable.payrollType} = 'hourly'
                      THEN ${labourEntriesTable.hoursWorked}::numeric ELSE 0 END), 0)`,
      hourlyAmount: sql<string>`COALESCE(SUM(CASE WHEN ${labourEntriesTable.payrollType} = 'hourly'
                      THEN ${labourEntriesTable.amountPayable}::numeric ELSE 0 END), 0)`,

      metersAt25:   sql<string>`COALESCE(SUM(CASE WHEN ${labourEntriesTable.payrollType} = 'piece_work'
                      AND ${labourEntriesTable.rateUsed}::numeric = 25
                      THEN ${labourEntriesTable.metersCompleted}::numeric ELSE 0 END), 0)`,
      metersAt30:   sql<string>`COALESCE(SUM(CASE WHEN ${labourEntriesTable.payrollType} = 'piece_work'
                      AND ${labourEntriesTable.rateUsed}::numeric = 30
                      THEN ${labourEntriesTable.metersCompleted}::numeric ELSE 0 END), 0)`,
      totalMeters:  sql<string>`COALESCE(SUM(CASE WHEN ${labourEntriesTable.payrollType} = 'piece_work'
                      THEN ${labourEntriesTable.metersCompleted}::numeric ELSE 0 END), 0)`,
      pieceAmount:  sql<string>`COALESCE(SUM(CASE WHEN ${labourEntriesTable.payrollType} = 'piece_work'
                      THEN ${labourEntriesTable.amountPayable}::numeric ELSE 0 END), 0)`,

      totalAmount:  sql<string>`COALESCE(SUM(${labourEntriesTable.amountPayable}::numeric), 0)`,
      entryCount:   sql<number>`COUNT(*)`,
    })
    .from(labourEntriesTable)
    .leftJoin(usersTable, eq(labourEntriesTable.employeeId, usersTable.id))
    .where(and(...conds))
    .groupBy(usersTable.id, usersTable.name, usersTable.employeeNumber, usersTable.clockNumber)
    .orderBy(usersTable.name);

  const result = rows.map(row => ({
    employeeId:     row.employeeId,
    employeeName:   row.employeeName ?? "Unknown",
    employeeNumber: row.employeeNumber ?? null,
    clockNumber:    row.clockNumber ?? null,
    totalHours:     parseFloat(row.totalHours),
    hourlyAmount:   parseFloat(row.hourlyAmount),
    metersAt25:     parseFloat(row.metersAt25),
    metersAt30:     parseFloat(row.metersAt30),
    totalMeters:    parseFloat(row.totalMeters),
    pieceAmount:    parseFloat(row.pieceAmount),
    totalAmount:    parseFloat(row.totalAmount),
    entryCount:     Number(row.entryCount),
  }));

  r.log.info({ count: result.length, startDate, endDate }, "payroll summary fetched");
  res.json(result);
});

// ── GET /payroll/entries ──────────────────────────────────────────────────────
router.get("/payroll/entries", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const r = req as AuthReq;
  const { startDate, endDate, employeeId, jobId } = req.query as Record<string, string | undefined>;

  const conds: any[] = [];
  if (startDate)  conds.push(gte(labourEntriesTable.date, startDate));
  if (endDate)    conds.push(lte(labourEntriesTable.date, endDate));
  if (employeeId) conds.push(eq(labourEntriesTable.employeeId, parseInt(employeeId, 10)));
  if (jobId)      conds.push(eq(labourEntriesTable.jobId, parseInt(jobId, 10)));

  const rows = await db
    .select({ entry: labourEntriesTable, employee: usersTable })
    .from(labourEntriesTable)
    .leftJoin(usersTable, eq(labourEntriesTable.employeeId, usersTable.id))
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(labourEntriesTable.date, usersTable.name);

  r.log.info({ count: rows.length }, "payroll entries fetched");

  res.json(rows.map(r => ({
    ...r.entry,
    hoursWorked:     r.entry.hoursWorked     ? String(r.entry.hoursWorked)     : null,
    metersCompleted: r.entry.metersCompleted ? String(r.entry.metersCompleted) : null,
    amountPayable:   r.entry.amountPayable   ? String(r.entry.amountPayable)   : null,
    rateUsed:        r.entry.rateUsed        ? String(r.entry.rateUsed)        : null,
    startChainage:   r.entry.startChainage   ? String(r.entry.startChainage)   : null,
    endChainage:     r.entry.endChainage     ? String(r.entry.endChainage)     : null,
    createdAt:       r.entry.createdAt.toISOString(),
    employee: r.employee ? {
      id:             r.employee.id,
      name:           r.employee.name,
      employeeNumber: r.employee.employeeNumber ?? null,
      clockNumber:    r.employee.clockNumber    ?? null,
    } : null,
  })));
});

// ── GET /payroll/pdf/summary ──────────────────────────────────────────────────
router.get("/payroll/pdf/summary", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const { startDate, endDate } = req.query as Record<string, string | undefined>;
  try {
    const conds: any[] = [payrollFilter()];
    if (startDate) conds.push(gte(labourEntriesTable.date, startDate));
    if (endDate)   conds.push(lte(labourEntriesTable.date, endDate));
    const rows = await db
      .select({
        employeeId:     usersTable.id,
        employeeName:   usersTable.name,
        employeeNumber: usersTable.employeeNumber,
        clockNumber:    usersTable.clockNumber,
        totalHours:     sql<string>`COALESCE(SUM(CASE WHEN ${labourEntriesTable.payrollType}='hourly' THEN ${labourEntriesTable.hoursWorked}::numeric ELSE 0 END),0)`,
        hourlyAmount:   sql<string>`COALESCE(SUM(CASE WHEN ${labourEntriesTable.payrollType}='hourly' THEN ${labourEntriesTable.amountPayable}::numeric ELSE 0 END),0)`,
        metersAt25:     sql<string>`COALESCE(SUM(CASE WHEN ${labourEntriesTable.payrollType}='piece_work' AND ${labourEntriesTable.rateUsed}::numeric=25 THEN ${labourEntriesTable.metersCompleted}::numeric ELSE 0 END),0)`,
        metersAt30:     sql<string>`COALESCE(SUM(CASE WHEN ${labourEntriesTable.payrollType}='piece_work' AND ${labourEntriesTable.rateUsed}::numeric=30 THEN ${labourEntriesTable.metersCompleted}::numeric ELSE 0 END),0)`,
        totalMeters:    sql<string>`COALESCE(SUM(CASE WHEN ${labourEntriesTable.payrollType}='piece_work' THEN ${labourEntriesTable.metersCompleted}::numeric ELSE 0 END),0)`,
        pieceAmount:    sql<string>`COALESCE(SUM(CASE WHEN ${labourEntriesTable.payrollType}='piece_work' THEN ${labourEntriesTable.amountPayable}::numeric ELSE 0 END),0)`,
        totalAmount:    sql<string>`COALESCE(SUM(${labourEntriesTable.amountPayable}::numeric),0)`,
        entryCount:     sql<number>`COUNT(*)`,
      })
      .from(labourEntriesTable)
      .leftJoin(usersTable, eq(labourEntriesTable.employeeId, usersTable.id))
      .where(and(...conds))
      .groupBy(usersTable.id, usersTable.name, usersTable.employeeNumber, usersTable.clockNumber)
      .orderBy(usersTable.name);
    const result = rows.map(r => ({
      employeeId:     r.employeeId,
      employeeName:   r.employeeName ?? "Unknown",
      employeeNumber: r.employeeNumber ?? null,
      clockNumber:    r.clockNumber ?? null,
      totalHours:     parseFloat(r.totalHours),
      hourlyAmount:   parseFloat(r.hourlyAmount),
      metersAt25:     parseFloat(r.metersAt25),
      metersAt30:     parseFloat(r.metersAt30),
      totalMeters:    parseFloat(r.totalMeters),
      pieceAmount:    parseFloat(r.pieceAmount),
      totalAmount:    parseFloat(r.totalAmount),
      entryCount:     Number(r.entryCount),
    }));
    generatePayrollSummaryPDF(result, startDate ?? "", endDate ?? "", res);
  } catch (err) {
    req.log?.error({ err }, "Payroll summary PDF failed");
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF" });
  }
});

// ── GET /payroll/pdf/employee/:employeeId ─────────────────────────────────────
router.get("/payroll/pdf/employee/:employeeId", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const empId = parseInt(req.params.employeeId as string, 10);
  const { startDate, endDate } = req.query as Record<string, string | undefined>;
  if (!empId || isNaN(empId)) { res.status(400).json({ error: "Invalid employee ID" }); return; }
  try {
    const [employee] = await db.select().from(usersTable).where(eq(usersTable.id, empId));
    if (!employee) { res.status(404).json({ error: "Employee not found" }); return; }

    const conds: any[] = [payrollFilter(), eq(labourEntriesTable.employeeId, empId)];
    if (startDate) conds.push(gte(labourEntriesTable.date, startDate));
    if (endDate)   conds.push(lte(labourEntriesTable.date, endDate));

    const [summaryRows, entryRows] = await Promise.all([
      db.select({
        totalHours:   sql<string>`COALESCE(SUM(CASE WHEN ${labourEntriesTable.payrollType}='hourly' THEN ${labourEntriesTable.hoursWorked}::numeric ELSE 0 END),0)`,
        hourlyAmount: sql<string>`COALESCE(SUM(CASE WHEN ${labourEntriesTable.payrollType}='hourly' THEN ${labourEntriesTable.amountPayable}::numeric ELSE 0 END),0)`,
        metersAt25:   sql<string>`COALESCE(SUM(CASE WHEN ${labourEntriesTable.payrollType}='piece_work' AND ${labourEntriesTable.rateUsed}::numeric=25 THEN ${labourEntriesTable.metersCompleted}::numeric ELSE 0 END),0)`,
        metersAt30:   sql<string>`COALESCE(SUM(CASE WHEN ${labourEntriesTable.payrollType}='piece_work' AND ${labourEntriesTable.rateUsed}::numeric=30 THEN ${labourEntriesTable.metersCompleted}::numeric ELSE 0 END),0)`,
        totalMeters:  sql<string>`COALESCE(SUM(CASE WHEN ${labourEntriesTable.payrollType}='piece_work' THEN ${labourEntriesTable.metersCompleted}::numeric ELSE 0 END),0)`,
        pieceAmount:  sql<string>`COALESCE(SUM(CASE WHEN ${labourEntriesTable.payrollType}='piece_work' THEN ${labourEntriesTable.amountPayable}::numeric ELSE 0 END),0)`,
        totalAmount:  sql<string>`COALESCE(SUM(${labourEntriesTable.amountPayable}::numeric),0)`,
      }).from(labourEntriesTable).where(and(...conds)),
      db.select({ entry: labourEntriesTable, job: jobsTable })
        .from(labourEntriesTable)
        .leftJoin(jobsTable, eq(labourEntriesTable.jobId, jobsTable.id))
        .where(and(...conds.filter((c, i) => i !== 0))) // entries without payrollFilter — show all statuses
        .orderBy(labourEntriesTable.date),
    ]);

    const summary = summaryRows[0];
    const entries = entryRows.map(r => ({
      ...r.entry,
      hoursWorked:     r.entry.hoursWorked     ? String(r.entry.hoursWorked)     : null,
      metersCompleted: r.entry.metersCompleted ? String(r.entry.metersCompleted) : null,
      amountPayable:   r.entry.amountPayable   ? String(r.entry.amountPayable)   : null,
      rateUsed:        r.entry.rateUsed        ? String(r.entry.rateUsed)        : null,
      jobName:         r.job?.projectName ?? null,
      jobNumber:       r.job?.jobNumber ?? null,
    }));

    generateEmployeePayrollPDF(
      { name: employee.name, employeeNumber: employee.employeeNumber ?? null, clockNumber: employee.clockNumber ?? null },
      {
        totalHours:   parseFloat(summary.totalHours),
        hourlyAmount: parseFloat(summary.hourlyAmount),
        metersAt25:   parseFloat(summary.metersAt25),
        metersAt30:   parseFloat(summary.metersAt30),
        totalMeters:  parseFloat(summary.totalMeters),
        pieceAmount:  parseFloat(summary.pieceAmount),
        totalAmount:  parseFloat(summary.totalAmount),
      },
      entries,
      startDate ?? "",
      endDate ?? "",
      res,
    );
  } catch (err) {
    req.log?.error({ err }, "Employee payroll PDF failed");
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF" });
  }
});

// ── GET /payroll/pdf/job/:jobId ───────────────────────────────────────────────
router.get("/payroll/pdf/job/:jobId", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const jid = parseInt(req.params.jobId as string, 10);
  const { startDate, endDate } = req.query as Record<string, string | undefined>;
  if (!jid || isNaN(jid)) { res.status(400).json({ error: "Invalid job ID" }); return; }
  try {
    const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jid));
    if (!job) { res.status(404).json({ error: "Job not found" }); return; }

    const conds: any[] = [payrollFilter(), eq(labourEntriesTable.jobId, jid)];
    if (startDate) conds.push(gte(labourEntriesTable.date, startDate));
    if (endDate)   conds.push(lte(labourEntriesTable.date, endDate));

    const rows = await db
      .select({
        employeeId:     usersTable.id,
        employeeName:   usersTable.name,
        employeeNumber: usersTable.employeeNumber,
        clockNumber:    usersTable.clockNumber,
        totalHours:     sql<string>`COALESCE(SUM(CASE WHEN ${labourEntriesTable.payrollType}='hourly' THEN ${labourEntriesTable.hoursWorked}::numeric ELSE 0 END),0)`,
        hourlyAmount:   sql<string>`COALESCE(SUM(CASE WHEN ${labourEntriesTable.payrollType}='hourly' THEN ${labourEntriesTable.amountPayable}::numeric ELSE 0 END),0)`,
        metersAt25:     sql<string>`COALESCE(SUM(CASE WHEN ${labourEntriesTable.payrollType}='piece_work' AND ${labourEntriesTable.rateUsed}::numeric=25 THEN ${labourEntriesTable.metersCompleted}::numeric ELSE 0 END),0)`,
        metersAt30:     sql<string>`COALESCE(SUM(CASE WHEN ${labourEntriesTable.payrollType}='piece_work' AND ${labourEntriesTable.rateUsed}::numeric=30 THEN ${labourEntriesTable.metersCompleted}::numeric ELSE 0 END),0)`,
        totalMeters:    sql<string>`COALESCE(SUM(CASE WHEN ${labourEntriesTable.payrollType}='piece_work' THEN ${labourEntriesTable.metersCompleted}::numeric ELSE 0 END),0)`,
        pieceAmount:    sql<string>`COALESCE(SUM(CASE WHEN ${labourEntriesTable.payrollType}='piece_work' THEN ${labourEntriesTable.amountPayable}::numeric ELSE 0 END),0)`,
        totalAmount:    sql<string>`COALESCE(SUM(${labourEntriesTable.amountPayable}::numeric),0)`,
        entryCount:     sql<number>`COUNT(*)`,
      })
      .from(labourEntriesTable)
      .leftJoin(usersTable, eq(labourEntriesTable.employeeId, usersTable.id))
      .where(and(...conds))
      .groupBy(usersTable.id, usersTable.name, usersTable.employeeNumber, usersTable.clockNumber)
      .orderBy(usersTable.name);

    const result = rows.map(r => ({
      employeeId:     r.employeeId,
      employeeName:   r.employeeName ?? "Unknown",
      employeeNumber: r.employeeNumber ?? null,
      clockNumber:    r.clockNumber ?? null,
      totalHours:     parseFloat(r.totalHours),
      hourlyAmount:   parseFloat(r.hourlyAmount),
      metersAt25:     parseFloat(r.metersAt25),
      metersAt30:     parseFloat(r.metersAt30),
      totalMeters:    parseFloat(r.totalMeters),
      pieceAmount:    parseFloat(r.pieceAmount),
      totalAmount:    parseFloat(r.totalAmount),
      entryCount:     Number(r.entryCount),
    }));

    generateJobPayrollCostPDF(job, result, startDate ?? "", endDate ?? "", res);
  } catch (err) {
    req.log?.error({ err }, "Job payroll cost PDF failed");
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF" });
  }
});

export default router;
