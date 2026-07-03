import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, employeeBankingTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(s, 10);
}

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    phone: u.phone ?? null,
    employeeNumber: u.employeeNumber ?? null,
    clockNumber: u.clockNumber ?? null,
    idNumber: u.idNumber ?? null,
    dateOfBirth: u.dateOfBirth ?? null,
    homeAddress: u.homeAddress ?? null,
    emergencyContactName: u.emergencyContactName ?? null,
    emergencyContactNumber: u.emergencyContactNumber ?? null,
    jobTitle: u.jobTitle ?? null,
    department: u.department ?? null,
    supervisorId: u.supervisorId ?? null,
    employmentStartDate: u.employmentStartDate ?? null,
    employmentStatus: u.employmentStatus,
    payrollType: u.payrollType ?? null,
    hourlyRate: u.hourlyRate ? String(u.hourlyRate) : null,
    meterRate: u.meterRate ? String(u.meterRate) : null,
    createdAt: u.createdAt.toISOString(),
  };
}

router.get("/employees", requireAuth, async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable)
    .where(isNull(usersTable.deletedAt))
    .orderBy(usersTable.name);
  res.json(users.map(formatUser));
});

router.post("/employees", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const {
    name, email, role, phone, password,
    employeeNumber, clockNumber, idNumber, dateOfBirth,
    homeAddress, emergencyContactName, emergencyContactNumber,
    jobTitle, department, supervisorId, employmentStartDate,
    employmentStatus, payrollType, hourlyRate, meterRate,
  } = req.body as Record<string, string | number | undefined>;

  if (!name || !email || !role || !password) {
    res.status(400).json({ error: "Name, email, role, and password required" });
    return;
  }
  const passwordHash = await bcrypt.hash(password as string, 10);
  const [user] = await db.insert(usersTable).values({
    name: name as string,
    email: (email as string).toLowerCase(),
    passwordHash,
    role: role as "admin" | "project_manager" | "supervisor" | "worker",
    phone: phone as string | undefined,
    employeeNumber: employeeNumber as string | undefined,
    clockNumber: clockNumber as string | undefined,
    idNumber: idNumber as string | undefined,
    dateOfBirth: dateOfBirth as string | undefined,
    homeAddress: homeAddress as string | undefined,
    emergencyContactName: emergencyContactName as string | undefined,
    emergencyContactNumber: emergencyContactNumber as string | undefined,
    jobTitle: jobTitle as string | undefined,
    department: department as string | undefined,
    supervisorId: supervisorId ? Number(supervisorId) : undefined,
    employmentStartDate: employmentStartDate as string | undefined,
    employmentStatus: (employmentStatus as "active" | "suspended" | "resigned" | "dismissed") ?? "active",
    payrollType: payrollType as "hourly" | "piece_work" | undefined,
    hourlyRate: hourlyRate ? String(hourlyRate) : undefined,
    meterRate: meterRate ? String(meterRate) : undefined,
  }).returning();
  res.status(201).json(formatUser(user));
});

router.put("/employees/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const {
    name, email, role, phone,
    employeeNumber, clockNumber, idNumber, dateOfBirth,
    homeAddress, emergencyContactName, emergencyContactNumber,
    jobTitle, department, supervisorId, employmentStartDate,
    employmentStatus, payrollType, hourlyRate, meterRate,
  } = req.body as Record<string, string | number | undefined>;

  const [user] = await db.update(usersTable).set({
    ...(name !== undefined && { name: name as string }),
    ...(email !== undefined && { email: (email as string).toLowerCase() }),
    ...(role !== undefined && { role: role as "admin" | "project_manager" | "supervisor" | "worker" }),
    ...(phone !== undefined && { phone: phone as string }),
    ...(employeeNumber !== undefined && { employeeNumber: employeeNumber as string }),
    ...(clockNumber !== undefined && { clockNumber: clockNumber as string }),
    ...(idNumber !== undefined && { idNumber: idNumber as string }),
    ...(dateOfBirth !== undefined && { dateOfBirth: dateOfBirth as string }),
    ...(homeAddress !== undefined && { homeAddress: homeAddress as string }),
    ...(emergencyContactName !== undefined && { emergencyContactName: emergencyContactName as string }),
    ...(emergencyContactNumber !== undefined && { emergencyContactNumber: emergencyContactNumber as string }),
    ...(jobTitle !== undefined && { jobTitle: jobTitle as string }),
    ...(department !== undefined && { department: department as string }),
    ...(supervisorId !== undefined && { supervisorId: supervisorId ? Number(supervisorId) : null }),
    ...(employmentStartDate !== undefined && { employmentStartDate: employmentStartDate as string }),
    ...(employmentStatus !== undefined && { employmentStatus: employmentStatus as "active" | "suspended" | "resigned" | "dismissed" }),
    ...(payrollType !== undefined && { payrollType: payrollType as "hourly" | "piece_work" }),
    ...(hourlyRate !== undefined && { hourlyRate: hourlyRate ? String(hourlyRate) : null }),
    ...(meterRate !== undefined && { meterRate: meterRate ? String(meterRate) : null }),
  }).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "Employee not found" }); return; }
  res.json(formatUser(user));
});

router.delete("/employees/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, id));
  if (!existing) { res.status(404).json({ error: "Employee not found" }); return; }
  await db.update(usersTable).set({ deletedAt: new Date() }).where(eq(usersTable.id, id));
  res.sendStatus(204);
});

router.get("/employees/:id/banking", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [banking] = await db.select().from(employeeBankingTable).where(eq(employeeBankingTable.userId, id));
  if (!banking) { res.status(404).json({ error: "Banking details not found" }); return; }
  res.json(banking);
});

router.put("/employees/:id/banking", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const { bankName, accountHolder, accountNumber, branchCode, accountType } = req.body as {
    bankName: string; accountHolder: string; accountNumber: string; branchCode: string; accountType: string;
  };
  const existing = await db.select().from(employeeBankingTable).where(eq(employeeBankingTable.userId, id));
  let result;
  if (existing.length > 0) {
    [result] = await db.update(employeeBankingTable).set({
      bankName, accountHolder, accountNumber, branchCode,
      accountType: accountType as "cheque" | "savings" | "transmission",
    }).where(eq(employeeBankingTable.userId, id)).returning();
  } else {
    [result] = await db.insert(employeeBankingTable).values({
      userId: id, bankName, accountHolder, accountNumber, branchCode,
      accountType: (accountType ?? "cheque") as "cheque" | "savings" | "transmission",
    }).returning();
  }
  res.json(result);
});

export default router;
