import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, gpsLogsTable, labourEntriesTable, jobsTable } from "@workspace/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { requireAuth, requireRole, type AuthPayload } from "../middlewares/auth.js";

const router: IRouter = Router();

const DEFAULT_HOURLY_RATE = 25;

function hoursBetween(clockIn: string, clockOut: string): number {
  const [inHour, inMinute] = clockIn.split(":").map(Number);
  const [outHour, outMinute] = clockOut.split(":").map(Number);
  const minutes = (outHour * 60 + outMinute) - (inHour * 60 + inMinute);
  return Math.max(0, minutes / 60);
}

router.post("/attendance", requireAuth, requireRole("admin", "supervisor"), async (req: Request, res: Response): Promise<void> => {
  const { clockNumber, type, gps, jobId } = req.body as {
    clockNumber: string;
    type: 'IN' | 'OUT';
    gps?: { lat: number, lng: number };
    jobId: number;
  };

  const auth = (req as Request & { auth: AuthPayload }).auth;
  const supervisorId = auth.userId;

  const [employee] = await db.select().from(usersTable).where(eq(usersTable.clockNumber, clockNumber));
  if (!employee) { res.status(404).json({ error: "Employee not found" }); return; }
  if (employee.employmentStatus !== "active") {
    res.status(400).json({ error: "Employee is not active" });
    return;
  }

  const [job] = await db.select({ id: jobsTable.id, status: jobsTable.status })
    .from(jobsTable)
    .where(eq(jobsTable.id, jobId));
  if (!job || job.status === "completed" || job.status === "cancelled") {
    res.status(400).json({ error: "A valid active job is required" });
    return;
  }

  // An employee may not have two open attendance records, even across jobs.
  const [lastEntry] = await db.select().from(labourEntriesTable)
    .where(and(eq(labourEntriesTable.employeeId, employee.id), isNull(labourEntriesTable.clockOut)))
    .orderBy(desc(labourEntriesTable.createdAt))
    .limit(1);

  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toISOString().slice(11, 16);

  if (type === 'IN') {
    // If last entry has no clockOut, prevent new Clock IN
    if (lastEntry && !lastEntry.clockOut) {
        res.status(400).json({ error: "Already clocked IN" });
        return;
    }
    await db.insert(labourEntriesTable).values({
        employeeId: employee.id,
        clockIn: time,
        date,
        payrollType: employee.payrollType ?? 'hourly',
        jobId: jobId,
        createdById: supervisorId,
        workType: 'other',
    });
  } else {
    if (!lastEntry) {
        res.status(400).json({ error: "Not clocked IN" });
        return;
    }
    if (lastEntry.jobId !== jobId) {
      res.status(400).json({ error: "Employee is clocked in on a different job" });
      return;
    }

    const hoursWorked = hoursBetween(lastEntry.clockIn ?? time, time);
    const rateUsed = lastEntry.payrollType === "hourly"
      ? Number(employee.hourlyRate ?? DEFAULT_HOURLY_RATE)
      : null;
    await db.update(labourEntriesTable)
        .set({
          clockOut: time,
          hoursWorked: lastEntry.payrollType === "hourly" ? hoursWorked.toFixed(2) : null,
          rateUsed: rateUsed?.toFixed(2) ?? null,
          amountPayable: rateUsed != null ? (hoursWorked * rateUsed).toFixed(2) : "0.00",
          status: "complete",
        })
        .where(eq(labourEntriesTable.id, lastEntry.id));
  }

  if (gps) {
    await db.insert(gpsLogsTable).values({
        userId: employee.id,
        jobId: jobId,
        arrivalLat: gps.lat.toString(),
        arrivalLng: gps.lng.toString(),
        arrivalTime: now,
    });
  }

  res.json({ success: true, message: `Clocked ${type} successfully` });
});

export default router;
