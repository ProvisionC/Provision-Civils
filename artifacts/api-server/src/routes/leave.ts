import { Router, type IRouter } from "express";
import { db, leaveRecordsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole, type AuthPayload } from "../middlewares/auth.js";
import type { Request } from "express";

const router: IRouter = Router();

type AuthReq = Request & { auth: AuthPayload };

function parseId(raw: string | string[]): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(s, 10);
}

function formatLeave(l: typeof leaveRecordsTable.$inferSelect & { employee?: typeof usersTable.$inferSelect | null }) {
  return {
    id: l.id,
    employeeId: l.employeeId,
    leaveType: l.leaveType,
    startDate: l.startDate,
    endDate: l.endDate,
    days: String(l.days),
    status: l.status,
    notes: l.notes ?? null,
    approvedById: l.approvedById ?? null,
    createdAt: l.createdAt.toISOString(),
    employee: l.employee ? { id: l.employee.id, name: l.employee.name } : undefined,
  };
}

router.get("/leave", requireAuth, async (req, res): Promise<void> => {
  const auth = (req as AuthReq).auth;
  const employeeId = req.query.employeeId ? parseInt(req.query.employeeId as string, 10) : undefined;

  const isAdmin = auth.role === "admin" || auth.role === "project_manager" || auth.role === "supervisor";
  const targetId = isAdmin && employeeId ? employeeId : auth.userId;

  const rows = await db
    .select({ leave: leaveRecordsTable, employee: usersTable })
    .from(leaveRecordsTable)
    .leftJoin(usersTable, eq(leaveRecordsTable.employeeId, usersTable.id))
    .where(isAdmin && !employeeId ? undefined : eq(leaveRecordsTable.employeeId, targetId))
    .orderBy(leaveRecordsTable.startDate);

  res.json(rows.map(r => formatLeave({ ...r.leave, employee: r.employee })));
});

router.post("/leave", requireAuth, async (req, res): Promise<void> => {
  const auth = (req as AuthReq).auth;
  const { employeeId, leaveType, startDate, endDate, days, notes } = req.body as Record<string, any>;

  const isAdmin = auth.role === "admin" || auth.role === "project_manager" || auth.role === "supervisor";
  const targetEmployeeId = isAdmin && employeeId ? Number(employeeId) : auth.userId;

  if (!leaveType || !startDate || !endDate || !days) {
    res.status(400).json({ error: "leaveType, startDate, endDate, days required" });
    return;
  }
  const [leave] = await db.insert(leaveRecordsTable).values({
    employeeId: targetEmployeeId,
    leaveType,
    startDate,
    endDate,
    days: String(days),
    status: "pending",
    notes: notes ?? null,
  }).returning();
  res.status(201).json(formatLeave(leave));
});

router.put("/leave/:id/status", requireAuth, requireRole("admin", "supervisor"), async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const auth = (req as AuthReq).auth;
  const { status, notes } = req.body as { status: string; notes?: string };

  if (!["approved", "rejected", "pending"].includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }
  const [leave] = await db.update(leaveRecordsTable).set({
    status: status as "pending" | "approved" | "rejected",
    ...(status === "approved" && { approvedById: auth.userId }),
    ...(notes !== undefined && { notes }),
  }).where(eq(leaveRecordsTable.id, id)).returning();
  if (!leave) { res.status(404).json({ error: "Leave record not found" }); return; }
  res.json(formatLeave(leave));
});

router.delete("/leave/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [deleted] = await db.delete(leaveRecordsTable).where(eq(leaveRecordsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Leave record not found" }); return; }
  res.sendStatus(204);
});

export default router;
