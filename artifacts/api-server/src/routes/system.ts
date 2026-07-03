import { Router, type IRouter } from "express";
import { db, backupsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router: IRouter = Router();

const APP_VERSION = "2.0.0";
const startedAt = Date.now();

router.get("/system/status", requireAuth, requireRole("admin", "supervisor"), async (req, res): Promise<void> => {
  let dbOnline = false;
  try {
    await db.execute("SELECT 1" as unknown as Parameters<typeof db.execute>[0]);
    dbOnline = true;
  } catch {
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
