import { Router, type IRouter } from "express";
import { db, labourEntriesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole, type AuthPayload } from "../middlewares/auth.js";
import type { Request } from "express";

type AuthReq = Request & { auth: AuthPayload };

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(s, 10);
}

function formatEntry(e: typeof labourEntriesTable.$inferSelect & { employee?: typeof usersTable.$inferSelect | null }) {
  return {
    id: e.id,
    jobId: e.jobId,
    employeeId: e.employeeId,
    date: e.date,
    workType: e.workType,
    payrollType: e.payrollType,
    clockIn: e.clockIn ?? null,
    clockOut: e.clockOut ?? null,
    breakMinutes: e.breakMinutes,
    hoursWorked: e.hoursWorked ? String(e.hoursWorked) : null,
    startChainage: e.startChainage ? String(e.startChainage) : null,
    endChainage: e.endChainage ? String(e.endChainage) : null,
    metersCompleted: e.metersCompleted ? String(e.metersCompleted) : null,
    rateUsed: e.rateUsed ? String(e.rateUsed) : null,
    amountPayable: e.amountPayable ? String(e.amountPayable) : null,
    status: e.status,
    notes: e.notes ?? null,
    createdById: e.createdById,
    createdAt: e.createdAt.toISOString(),
    employee: e.employee ? { id: e.employee.id, name: e.employee.name } : undefined,
  };
}

router.get("/labour-entries", requireAuth, async (req, res): Promise<void> => {
  const jobId = req.query.jobId ? parseInt(req.query.jobId as string, 10) : undefined;
  const employeeId = req.query.employeeId ? parseInt(req.query.employeeId as string, 10) : undefined;

  const rows = await db
    .select({ entry: labourEntriesTable, employee: usersTable })
    .from(labourEntriesTable)
    .leftJoin(usersTable, eq(labourEntriesTable.employeeId, usersTable.id))
    .where(
      jobId && employeeId ? and(eq(labourEntriesTable.jobId, jobId), eq(labourEntriesTable.employeeId, employeeId))
        : jobId ? eq(labourEntriesTable.jobId, jobId)
        : employeeId ? eq(labourEntriesTable.employeeId, employeeId)
        : undefined
    )
    .orderBy(labourEntriesTable.date);

  res.json(rows.map(r => formatEntry({ ...r.entry, employee: r.employee })));
});

router.post("/labour-entries", requireAuth, requireRole("admin", "supervisor"), async (req, res): Promise<void> => {
  const auth = (req as AuthReq).auth;
  const {
    jobId, employeeId, date, workType, payrollType,
    clockIn, clockOut, breakMinutes, hoursWorked,
    startChainage, endChainage, metersCompleted, rateUsed, amountPayable,
    status, notes,
  } = req.body as Record<string, any>;

  if (!jobId || !employeeId || !date || !workType || !payrollType) {
    res.status(400).json({ error: "jobId, employeeId, date, workType, payrollType required" });
    return;
  }

  const [entry] = await db.insert(labourEntriesTable).values({
    jobId: Number(jobId),
    employeeId: Number(employeeId),
    date,
    workType,
    payrollType,
    clockIn: clockIn ?? null,
    clockOut: clockOut ?? null,
    breakMinutes: breakMinutes ? Number(breakMinutes) : 0,
    hoursWorked: hoursWorked ? String(hoursWorked) : null,
    startChainage: startChainage ? String(startChainage) : null,
    endChainage: endChainage ? String(endChainage) : null,
    metersCompleted: metersCompleted ? String(metersCompleted) : null,
    rateUsed: rateUsed ? String(rateUsed) : null,
    amountPayable: amountPayable ? String(amountPayable) : null,
    status: status ?? "open",
    notes: notes ?? null,
    createdById: auth.userId,
  }).returning();
  res.status(201).json(formatEntry(entry));
});

router.put("/labour-entries/:id", requireAuth, requireRole("admin", "supervisor"), async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const {
    clockIn, clockOut, breakMinutes, hoursWorked,
    startChainage, endChainage, metersCompleted, rateUsed, amountPayable,
    status, notes, workType, payrollType, date,
  } = req.body as Record<string, any>;

  const [entry] = await db.update(labourEntriesTable).set({
    ...(date !== undefined && { date }),
    ...(workType !== undefined && { workType }),
    ...(payrollType !== undefined && { payrollType }),
    ...(clockIn !== undefined && { clockIn }),
    ...(clockOut !== undefined && { clockOut }),
    ...(breakMinutes !== undefined && { breakMinutes: Number(breakMinutes) }),
    ...(hoursWorked !== undefined && { hoursWorked: hoursWorked ? String(hoursWorked) : null }),
    ...(startChainage !== undefined && { startChainage: startChainage ? String(startChainage) : null }),
    ...(endChainage !== undefined && { endChainage: endChainage ? String(endChainage) : null }),
    ...(metersCompleted !== undefined && { metersCompleted: metersCompleted ? String(metersCompleted) : null }),
    ...(rateUsed !== undefined && { rateUsed: rateUsed ? String(rateUsed) : null }),
    ...(amountPayable !== undefined && { amountPayable: amountPayable ? String(amountPayable) : null }),
    ...(status !== undefined && { status }),
    ...(notes !== undefined && { notes }),
  }).where(eq(labourEntriesTable.id, id)).returning();
  if (!entry) { res.status(404).json({ error: "Labour entry not found" }); return; }
  res.json(formatEntry(entry));
});

router.delete("/labour-entries/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [deleted] = await db.delete(labourEntriesTable).where(eq(labourEntriesTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Labour entry not found" }); return; }
  res.sendStatus(204);
});

export default router;
