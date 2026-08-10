import { Router, type IRouter } from "express";
import { db, backupsTable, jobsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router: IRouter = Router();

const APP_VERSION = "2.0.0";
const startedAt = Date.now();

router.get("/system/status", requireAuth, requireRole("admin", "supervisor"), async (req, res): Promise<void> => {
  let dbOnline = false;
  try {
    // The previous implementation of db.execute('SELECT 1') might be failing or returning unexpected types.
    // Try a simpler approach if available or just ensure it returns a result.
    await db.select({ val: sql`1` }).from(jobsTable).limit(1);
    dbOnline = true;
  } catch (e) {
    console.error("Health check DB error:", e);
    dbOnline = false;
  }

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
