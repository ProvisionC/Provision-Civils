import { Router, type IRouter } from "express";
import { db, labourEntriesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole, type AuthPayload } from "../middlewares/auth.js";
import type { Request } from "express";

const router: IRouter = Router();
type AuthReq = Request & { auth: AuthPayload };

const HOURLY_RATE = 25;
const BREAK_MINUTES = 30;
const VALID_METER_RATES = [25, 30] as const;
type MeterRate = typeof VALID_METER_RATES[number];

function parseId(raw: string | string[]): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(s, 10);
}

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function calcHours(clockIn: string, clockOut: string): number {
  const diff = parseTime(clockOut) - parseTime(clockIn) - BREAK_MINUTES;
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
  if (entry.payrollType === "piece_work" && entry.status === "complete") {
    return (entry.metersCompleted ?? 0) * (entry.rateUsed ?? 0);
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

// POST /labour-entries/batch — daily multi-employee entry
router.post("/labour-entries/batch", requireAuth, requireRole("admin", "supervisor"), async (req, res): Promise<void> => {
  const auth = (req as AuthReq).auth;
  const { jobId, date, entries } = req.body as {
    jobId: number;
    date: string;
    supervisorId?: number;
    entries: Array<{
      employeeId: number;
      payrollType: "hourly" | "piece_work";
      workType?: string;
      clockIn?: string;
      clockOut?: string;
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

  // Validate entries
  for (const e of entries) {
    if (e.payrollType !== "hourly" && e.payrollType !== "piece_work") {
      res.status(400).json({ error: `Invalid payrollType "${e.payrollType}": must be hourly or piece_work` });
      return;
    }
    if (e.payrollType === "piece_work" && e.ratePerMeter != null) {
      const r = Number(e.ratePerMeter);
      if (!VALID_METER_RATES.includes(r as MeterRate)) {
        res.status(400).json({ error: `Invalid ratePerMeter ${r}: must be 25 or 30` });
        return;
      }
    }
  }

  const values = entries.map(e => {
    const payrollType = e.payrollType;
    const entryStatus = (e.status ?? "complete") as "open" | "complete";
    let hw: number | null = null;
    let rate: number | null = null;
    let amount = 0;

    if (payrollType === "hourly") {
      if (e.clockIn && e.clockOut) {
        hw = calcHours(e.clockIn, e.clockOut);
      }
      rate = HOURLY_RATE;
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
      workType: (e.workType ?? (payrollType === "piece_work" ? "trenching" : "other")) as any,
      payrollType: payrollType as "hourly" | "piece_work",
      clockIn: e.clockIn ?? null,
      clockOut: e.clockOut ?? null,
      breakMinutes: payrollType === "hourly" ? BREAK_MINUTES : 0,
      hoursWorked: hw != null ? String(hw.toFixed(2)) : null,
      startChainage: null,
      endChainage: null,
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

// PUT /labour-entries/:id — recalculate on status/field change
router.put("/labour-entries/:id", requireAuth, requireRole("admin", "supervisor"), async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const { clockIn, clockOut, metersCompleted, status, notes, workType, date } = req.body as Record<string, any>;

  const [current] = await db.select().from(labourEntriesTable).where(eq(labourEntriesTable.id, id)).limit(1);
  if (!current) { res.status(404).json({ error: "Labour entry not found" }); return; }

  const newStatus = status ?? current.status;
  const newClockIn = clockIn !== undefined ? clockIn : current.clockIn;
  const newClockOut = clockOut !== undefined ? clockOut : current.clockOut;

  let newHours: number | null = current.hoursWorked ? Number(current.hoursWorked) : null;
  if (current.payrollType === "hourly" && newClockIn && newClockOut) {
    newHours = calcHours(newClockIn, newClockOut);
  }

  const currentRate = current.rateUsed ? Number(current.rateUsed) : null;
  const newMeters = metersCompleted !== undefined
    ? (metersCompleted ? Number(metersCompleted) : null)
    : (current.metersCompleted ? Number(current.metersCompleted) : null);

  const newAmount = calcAmount({
    payrollType: current.payrollType,
    status: newStatus,
    hoursWorked: newHours,
    metersCompleted: newMeters,
    rateUsed: current.payrollType === "hourly" ? HOURLY_RATE : currentRate,
  });

  const [entry] = await db.update(labourEntriesTable).set({
    ...(date !== undefined && { date }),
    ...(workType !== undefined && { workType }),
    ...(clockIn !== undefined && { clockIn }),
    ...(clockOut !== undefined && { clockOut }),
    hoursWorked: newHours != null ? String(newHours.toFixed(2)) : null,
    metersCompleted: newMeters != null ? String(newMeters) : null,
    rateUsed: current.payrollType === "hourly" ? String(HOURLY_RATE) : (current.rateUsed ?? null),
    amountPayable: String(newAmount.toFixed(2)),
    status: newStatus,
    ...(notes !== undefined && { notes }),
  }).where(eq(labourEntriesTable.id, id)).returning();

  if (!entry) { res.status(404).json({ error: "Labour entry not found" }); return; }
  res.json(formatEntry(entry));
});

// DELETE /labour-entries/:id
router.delete("/labour-entries/:id", requireAuth, requireRole("admin", "supervisor"), async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [deleted] = await db.delete(labourEntriesTable).where(eq(labourEntriesTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Labour entry not found" }); return; }
  res.sendStatus(204);
});

export default router;
