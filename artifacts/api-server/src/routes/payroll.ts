import { Router, type IRouter } from "express";
import { db, labourEntriesTable, usersTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";
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
  const { startDate, endDate, employeeId } = req.query as Record<string, string | undefined>;

  const conds: any[] = [payrollFilter()];
  if (startDate) conds.push(gte(labourEntriesTable.date, startDate));
  if (endDate)   conds.push(lte(labourEntriesTable.date, endDate));
  if (employeeId) conds.push(eq(labourEntriesTable.employeeId, parseInt(employeeId, 10)));

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
  const { startDate, endDate, employeeId } = req.query as Record<string, string | undefined>;

  const conds: any[] = [];
  if (startDate)  conds.push(gte(labourEntriesTable.date, startDate));
  if (endDate)    conds.push(lte(labourEntriesTable.date, endDate));
  if (employeeId) conds.push(eq(labourEntriesTable.employeeId, parseInt(employeeId, 10)));

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

export default router;
