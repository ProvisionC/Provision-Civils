import { Router, type IRouter } from "express";
import { db, labourEntriesTable, usersTable } from "@workspace/db";
import { eq, and, gte, lte, or, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router: IRouter = Router();

// Only include piece_work when complete; hourly always included
function payrollCondition() {
  return sql`(${labourEntriesTable.payrollType} = 'hourly' OR (${labourEntriesTable.payrollType} = 'piece_work' AND ${labourEntriesTable.status} = 'complete'))`;
}

router.get("/payroll/summary", requireAuth, requireRole("admin", "supervisor"), async (req, res): Promise<void> => {
  const { startDate, endDate, employeeId } = req.query as Record<string, string | undefined>;

  const conditions: any[] = [payrollCondition()];
  if (startDate) conditions.push(gte(labourEntriesTable.date, startDate));
  if (endDate) conditions.push(lte(labourEntriesTable.date, endDate));
  if (employeeId) conditions.push(eq(labourEntriesTable.employeeId, parseInt(employeeId, 10)));

  const rows = await db
    .select({
      employeeId: labourEntriesTable.employeeId,
      employeeName: usersTable.name,
      payrollType: labourEntriesTable.payrollType,
      totalHours: sql<string>`COALESCE(SUM(CASE WHEN ${labourEntriesTable.payrollType} = 'hourly' THEN ${labourEntriesTable.hoursWorked}::numeric ELSE 0 END), 0)`,
      totalMeters: sql<string>`COALESCE(SUM(CASE WHEN ${labourEntriesTable.payrollType} = 'piece_work' THEN ${labourEntriesTable.metersCompleted}::numeric ELSE 0 END), 0)`,
      totalAmount: sql<string>`COALESCE(SUM(${labourEntriesTable.amountPayable}::numeric), 0)`,
      entryCount: sql<number>`COUNT(*)`,
    })
    .from(labourEntriesTable)
    .leftJoin(usersTable, eq(labourEntriesTable.employeeId, usersTable.id))
    .where(and(...conditions))
    .groupBy(labourEntriesTable.employeeId, usersTable.name, labourEntriesTable.payrollType)
    .orderBy(usersTable.name);

  const grouped: Record<number, {
    employeeId: number; employeeName: string;
    totalHours: number; totalMeters: number; totalAmount: number; entryCount: number;
    hourlyAmount: number; pieceAmount: number;
  }> = {};

  for (const row of rows) {
    const eid = row.employeeId;
    if (!grouped[eid]) {
      grouped[eid] = {
        employeeId: eid,
        employeeName: row.employeeName ?? "Unknown",
        totalHours: 0, totalMeters: 0, totalAmount: 0, entryCount: 0,
        hourlyAmount: 0, pieceAmount: 0,
      };
    }
    grouped[eid].totalHours += parseFloat(row.totalHours);
    grouped[eid].totalMeters += parseFloat(row.totalMeters);
    grouped[eid].totalAmount += parseFloat(row.totalAmount);
    grouped[eid].entryCount += Number(row.entryCount);
    if (row.payrollType === "hourly") grouped[eid].hourlyAmount += parseFloat(row.totalAmount);
    if (row.payrollType === "piece_work") grouped[eid].pieceAmount += parseFloat(row.totalAmount);
  }

  res.json(Object.values(grouped));
});

router.get("/payroll/entries", requireAuth, requireRole("admin", "supervisor"), async (req, res): Promise<void> => {
  const { startDate, endDate, employeeId } = req.query as Record<string, string | undefined>;

  const conditions: any[] = [];
  if (startDate) conditions.push(gte(labourEntriesTable.date, startDate));
  if (endDate) conditions.push(lte(labourEntriesTable.date, endDate));
  if (employeeId) conditions.push(eq(labourEntriesTable.employeeId, parseInt(employeeId, 10)));

  const rows = await db
    .select({ entry: labourEntriesTable, employee: usersTable })
    .from(labourEntriesTable)
    .leftJoin(usersTable, eq(labourEntriesTable.employeeId, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(labourEntriesTable.date, usersTable.name);

  res.json(rows.map(r => ({
    ...r.entry,
    hoursWorked: r.entry.hoursWorked ? String(r.entry.hoursWorked) : null,
    metersCompleted: r.entry.metersCompleted ? String(r.entry.metersCompleted) : null,
    amountPayable: r.entry.amountPayable ? String(r.entry.amountPayable) : null,
    rateUsed: r.entry.rateUsed ? String(r.entry.rateUsed) : null,
    startChainage: r.entry.startChainage ? String(r.entry.startChainage) : null,
    endChainage: r.entry.endChainage ? String(r.entry.endChainage) : null,
    createdAt: r.entry.createdAt.toISOString(),
    employee: r.employee ? { id: r.employee.id, name: r.employee.name, employeeNumber: (r.employee as any).employeeNumber } : null,
  })));
});

export default router;
