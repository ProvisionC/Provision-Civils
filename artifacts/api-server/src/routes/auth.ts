import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, signToken } from "../middlewares/auth.js";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password, clockNumber, phone } = req.body as {
    email?: string; password?: string; clockNumber?: string; phone?: string;
  };

  if ((!email && !clockNumber) || !password) {
    res.status(400).json({ error: "Credentials required" });
    return;
  }

  let user;
  if (clockNumber) {
    [user] = await db.select().from(usersTable).where(eq(usersTable.clockNumber, clockNumber));
    if (user && phone) {
      const validPhone = user.phone?.replace(/\D/g, "") === phone.replace(/\D/g, "");
      if (!validPhone) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }
    }
  } else {
    [user] = await db.select().from(usersTable).where(eq(usersTable.email, email!.toLowerCase()));
  }

  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signToken(user.id, user.role);
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone ?? null,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const { userId } = (req as typeof req & { auth: { userId: number } }).auth;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone ?? null,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
