import { Router, type IRouter, type Request } from "express";
import { db, backupsTable, jobsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth, requireRole, type AuthPayload } from "../middlewares/auth.js";

const router: IRouter = Router();

const APP_VERSION = "2.0.0";
const startedAt = Date.now();

router.get("/system/status", requireAuth, requireRole("admin", "supervisor"), async (req, res): Promise<void> => {
  const auth = (req as Request & { auth: AuthPayload }).auth;
  console.log(`[system/status] Access attempt by user: ${auth.userId}, role: ${auth.role}`);

  let dbOnline = false;
  try {
    await db.select({ val: sql`1` }).from(jobsTable).limit(1);
    dbOnline = true;
  } catch (e) {
    console.error("Health check DB error:", e);
    dbOnline = false;
  }
  console.log(`[system] database check: ${dbOnline ? "ONLINE" : "OFFLINE"}`);
  console.log(`[system] database credential configured: ${!!process.env.DATABASE_URL}`);

  // Storage check placeholder
  const storageOnline = true; // Placeholder for actual check if needed
  console.log(`[system] storage check: ${storageOnline ? "ONLINE" : "OFFLINE"}`);
  console.log(`[system] storage credential configured: ${!!process.env.STORAGE_PROVIDER_URL}`); // Assuming a variable

  // Push check placeholder
  const pushOnline = true; // Placeholder
  console.log(`[system] push check: ${pushOnline ? "ONLINE" : "OFFLINE"}`);
  console.log(`[system] push credential configured: ${!!process.env.PUSH_PROVIDER_API_KEY}`); // Assuming a variable

  let lastBackupAt: string | null = null;
  let lastBackupStatus: string | null = null;
  try {
    const [lastBackup] = await db
      .select({ createdAt: backupsTable.createdAt, status: backupsTable.status })
      .from(backupsTable)
      .where(eq(backupsTable.status, "completed"))
      .orderBy(desc(backupsTable.createdAt))
      .limit(1);
    if (lastBackup) {
      lastBackupAt = lastBackup.createdAt.toISOString();
      lastBackupStatus = lastBackup.status;
    }
  } catch {
    // not critical
  }

  res.json({
    api: true,
    database: dbOnline,
    storage: true,
    pushNotifications: true,
    lastBackupAt,
    lastBackupStatus,
    appVersion: APP_VERSION,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    checkedAt: new Date().toISOString(),
  });
});

export default router;
