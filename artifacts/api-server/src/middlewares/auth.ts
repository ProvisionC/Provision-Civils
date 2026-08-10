import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { isWorkerAllowedRoute } from "../utils/workerAccess.js";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.SESSION_SECRET ?? "provision-civils-secret";

export interface AuthPayload {
  userId: number;
  role: string;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    
    // Fetch latest user role from DB
    const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
    
    if (!user) {
        res.status(401).json({ error: "User not found" });
        return;
    }
    
    const authPayload = { userId: payload.userId, role: user.role };
    (req as Request & { auth: AuthPayload }).auth = authPayload;

    if (authPayload.role === "worker" && !isWorkerAllowedRoute(req.path)) {
      res.status(403).json({ error: "Worker access denied" });
      return;
    }

    next();
  } catch (err) {
    console.error("Auth error:", err);
    res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const auth = (req as Request & { auth?: AuthPayload }).auth;
    if (!auth || !roles.includes(auth.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

export function signToken(userId: number, role: string): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "30d" });
}
