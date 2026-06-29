import { Router, type IRouter } from "express";
import { db, labourEntriesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole, type AuthPayload } from "../middlewares/auth.js";
import type { Request } from "express";

const router: IRouter = Router();
type AuthReq = Request & { auth: AuthPayload };

function parseId(raw: string | string[]): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(s, 10);
}

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function calcHours(clockIn: string, clockOut: string, breakMinutes: number): number {
  const diff = parseTime(clockOut) - parseTime(clockIn) - (breakMinutes || 0);
  return Math.max(0, diff) / 60;
}

function calcAmount(entry: {
  payrollType: string;
  status: string;
  hoursWorked?: number | null;
  metersCompleted?: number | null;
  rateUsed?: number | null;
}): number {
  if (entry.payrollType === "hourly") {
    return (entry.hoursWorked ?? 0) * (entry.rateUsed ?? 0);
  }
  if (entry.payrollType === "piece_work") {
    if (entry.status === "complete") {
      return (entry.metersCompleted ?? 0) * (entry.rateUsed ?? 0);
    }
    return 0;
  }
  return 0;
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

// GET /labour-entries
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

// POST /labour-entries (single)
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

  const hw = clockIn && clockOut
    ? calcHours(clockIn, clockOut, Number(breakMinutes ?? 0))
    : hoursWorked ? Number(hoursWorked) : null;

  const rate = rateUsed ? Number(rateUsed) : null;
  const meters = metersCompleted ? Number(metersCompleted) : null;
  const entryStatus = status ?? "open";
  const amount = amountPayable != null
    ? Number(amountPayable)
    : calcAmount({ payrollType, status: entryStatus, hoursWorked: hw, metersCompleted: meters, rateUsed: rate });

  const [entry] = await db.insert(labourEntriesTable).values({
    jobId: Number(jobId), employeeId: Number(employeeId), date, workType, payrollType,
    clockIn: clockIn ?? null, clockOut: clockOut ?? null,
    breakMinutes: breakMinutes ? Number(breakMinutes) : 0,
    hoursWorked: hw != null ? String(hw) : null,
    startChainage: startChainage ? String(startChainage) : null,
    endChainage: endChainage ? String(endChainage) : null,
    metersCompleted: meters != null ? String(meters) : null,
    rateUsed: rate != null ? String(rate) : null,
    amountPayable: String(amount),
    status: entryStatus,
    notes: notes ?? null,
    createdById: auth.userId,
  }).returning();

  res.status(201).json(formatEntry(entry));
});

// POST /labour-entries/batch — daily multi-employee entry
router.post("/labour-entries/batch", requireAuth, requireRole("admin", "supervisor"), async (req, res): Promise<void> => {
  const auth = (req as AuthReq).auth;
  const { jobId, date, entries } = req.body as {
    jobId: number;
    date: string;
    supervisorId?: number;
    entries: Array<{
      employeeId: number;
      workType: string;
      payrollType: string;
      clockIn?: string;
      clockOut?: string;
      breakMinutes?: number;
      hourlyRate?: number;
      startChainage?: number;
      endChainage?: number;
      metersCompleted?: number;
      ratePerMeter?: number;
      status?: string;
      notes?: string;
    }>;
  };

  if (!jobId || !date || !entries?.length) {
    res.status(400).json({ error: "jobId, date, and at least one entry required" });
    return;
  }

  const values = entries.map(e => {
    const entryStatus = (e.status ?? "open") as "open" | "complete";
    let hw: number | null = null;
    let rate: number | null = null;
    let amount = 0;

    if (e.payrollType === "hourly") {
      if (e.clockIn && e.clockOut) {
        hw = calcHours(e.clockIn, e.clockOut, Number(e.breakMinutes ?? 0));
      }
      rate = e.hourlyRate ? Number(e.hourlyRate) : null;
      amount = calcAmount({ payrollType: "hourly", status: entryStatus, hoursWorked: hw, rateUsed: rate });
    } else {
      rate = e.ratePerMeter ? Number(e.ratePerMeter) : null;
      const meters = e.metersCompleted ? Number(e.metersCompleted) : null;
      amount = calcAmount({ payrollType: "piece_work", status: entryStatus, metersCompleted: meters, rateUsed: rate });
    }

    return {
      jobId: Number(jobId),
      employeeId: Number(e.employeeId),
      date,
      workType: e.workType as any,
      payrollType: e.payrollType as "hourly" | "piece_work",
      clockIn: e.clockIn ?? null,
      clockOut: e.clockOut ?? null,
      breakMinutes: Number(e.breakMinutes ?? 0),
      hoursWorked: hw != null ? String(hw.toFixed(2)) : null,
      startChainage: e.startChainage != null ? String(e.startChainage) : null,
      endChainage: e.endChainage != null ? String(e.endChainage) : null,
      metersCompleted: e.metersCompleted != null ? String(e.metersCompleted) : null,
      rateUsed: rate != null ? String(rate) : null,
      amountPayable: String(amount.toFixed(2)),
      status: entryStatus,
      notes: e.notes ?? null,
      createdById: auth.userId,
    };
  });

  const inserted = await db.insert(labourEntriesTable).values(values).returning();
  res.status(201).json(inserted.map(e => formatEntry(e)));
});

// PUT /labour-entries/:id — recalculate amount on status change
router.put("/labour-entries/:id", requireAuth, requireRole("admin", "supervisor"), async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const {
    clockIn, clockOut, breakMinutes, hoursWorked,
    startChainage, endChainage, metersCompleted, rateUsed,
    status, notes, workType, payrollType, date,
  } = req.body as Record<string, any>;

  // Fetch current entry to recalculate
  const [current] = await db.select().from(labourEntriesTable).where(eq(labourEntriesTable.id, id)).limit(1);
  if (!current) { res.status(404).json({ error: "Labour entry not found" }); return; }

  const newPayrollType = payrollType ?? current.payrollType;
  const newStatus = status ?? current.status;

  // Recalculate hours if clock times change
  const newClockIn = clockIn !== undefined ? clockIn : current.clockIn;
  const newClockOut = clockOut !== undefined ? clockOut : current.clockOut;
  const newBreak = breakMinutes !== undefined ? Number(breakMinutes) : current.breakMinutes;

  let newHours: number | null = current.hoursWorked ? Number(current.hoursWorked) : null;
  if (newPayrollType === "hourly" && newClockIn && newClockOut) {
    newHours = calcHours(newClockIn, newClockOut, newBreak);
  } else if (hoursWorked !== undefined) {
    newHours = hoursWorked ? Number(hoursWorked) : null;
  }

  const newRate = rateUsed !== undefined ? (rateUsed ? Number(rateUsed) : null) : (current.rateUsed ? Number(current.rateUsed) : null);
  const newMeters = metersCompleted !== undefined ? (metersCompleted ? Number(metersCompleted) : null) : (current.metersCompleted ? Number(current.metersCompleted) : null);

  const newAmount = calcAmount({
    payrollType: newPayrollType,
    status: newStatus,
    hoursWorked: newHours,
    metersCompleted: newMeters,
    rateUsed: newRate,
  });

  const [entry] = await db.update(labourEntriesTable).set({
    ...(date !== undefined && { date }),
    ...(workType !== undefined && { workType }),
    ...(payrollType !== undefined && { payrollType }),
    ...(clockIn !== undefined && { clockIn }),
    ...(clockOut !== undefined && { clockOut }),
    ...(breakMinutes !== undefined && { breakMinutes: newBreak }),
    hoursWorked: newHours != null ? String(newHours.toFixed(2)) : null,
    ...(startChainage !== undefined && { startChainage: startChainage ? String(startChainage) : null }),
    ...(endChainage !== undefined && { endChainage: endChainage ? String(endChainage) : null }),
    metersCompleted: newMeters != null ? String(newMeters) : null,
    rateUsed: newRate != null ? String(newRate) : null,
    amountPayable: String(newAmount.toFixed(2)),
    status: newStatus,
    ...(notes !== undefined && { notes }),
  }).where(eq(labourEntriesTable.id, id)).returning();

  if (!entry) { res.status(404).json({ error: "Labour entry not found" }); return; }
  res.json(formatEntry(entry));
});

// DELETE /labour-entries/:id
router.delete("/labour-entries/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [deleted] = await db.delete(labourEntriesTable).where(eq(labourEntriesTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Labour entry not found" }); return; }
  res.sendStatus(204);
});

export default router;
