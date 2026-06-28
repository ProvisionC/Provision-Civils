import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(s, 10);
}

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id, name: u.name, email: u.email, role: u.role,
    phone: u.phone ?? null, createdAt: u.createdAt.toISOString(),
  };
}

router.get("/employees", requireAuth, async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(usersTable.name);
  res.json(users.map(formatUser));
});

router.post("/employees", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const { name, email, role, phone, password } = req.body as {
    name: string; email: string; role: string; phone?: string; password: string;
  };
  if (!name || !email || !role || !password) {
    res.status(400).json({ error: "Name, email, role, and password required" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({
    name, email: email.toLowerCase(), passwordHash,
    role: role as "admin" | "supervisor" | "worker",
    phone,
  }).returning();
  res.status(201).json(formatUser(user));
});

router.put("/employees/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const { name, email, role, phone } = req.body as {
    name?: string; email?: string; role?: string; phone?: string;
  };
  const [user] = await db.update(usersTable).set({
    ...(name && { name }),
    ...(email && { email: email.toLowerCase() }),
    ...(role && { role: role as "admin" | "supervisor" | "worker" }),
    ...(phone !== undefined && { phone }),
  }).where(eq(usersTable.id, id)).returning();
  if (!user) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  res.json(formatUser(user));
});

router.delete("/employees/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [deleted] = await db.delete(usersTable).where(eq(usersTable.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
