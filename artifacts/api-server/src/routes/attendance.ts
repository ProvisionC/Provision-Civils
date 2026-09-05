import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, gpsLogsTable, labourEntriesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireRole, type AuthPayload } from "../middlewares/auth.js";

const router: IRouter = Router();

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

  // Simple attendance: find last entry
  const [lastEntry] = await db.select().from(labourEntriesTable)
    .where(eq(labourEntriesTable.employeeId, employee.id))
    .orderBy(desc(labourEntriesTable.date))
    .limit(1);

  const now = new Date().toISOString();

  if (type === 'IN') {
    // If last entry has no clockOut, prevent new Clock IN
    if (lastEntry && !lastEntry.clockOut) {
        res.status(400).json({ error: "Already clocked IN" });
        return;
    }
    await db.insert(labourEntriesTable).values({
        employeeId: employee.id,
        clockIn: now,
        date: now.split("T")[0],
        payrollType: employee.payrollType ?? 'hourly',
        jobId: jobId,
        createdById: supervisorId,
        workType: 'other',
    });
  } else {
    // OUT: must have an active clockIn
    if (!lastEntry || lastEntry.clockOut) {
        res.status(400).json({ error: "Not clocked IN" });
        return;
    }
    await db.update(labourEntriesTable)
        .set({ clockOut: now })
        .where(eq(labourEntriesTable.id, lastEntry.id));
  }

  if (gps) {
    await db.insert(gpsLogsTable).values({
        userId: employee.id,
        jobId: jobId,
        arrivalLat: gps.lat.toString(),
        arrivalLng: gps.lng.toString(),
        arrivalTime: new Date(now),
    });
  }

  res.json({ success: true, message: `Clocked ${type} successfully` });
});

export default router;
