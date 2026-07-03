import { Router, type IRouter, type Request } from "express";
import { db, backupsTable, notificationsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireRole, type AuthPayload } from "../middlewares/auth.js";
import { logAudit } from "./audit.js";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import cron from "node-cron";

const router: IRouter = Router();
type AuthReq = Request & { auth: AuthPayload };
const execAsync = promisify(exec);

const BACKUP_DIR = process.env.BACKUP_DIR ?? "/tmp/db-backups";
const KEEP_BACKUPS = 30;

function parseId(raw: string | string[]): number {
  return parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
}

async function ensureBackupDir(): Promise<void> {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

async function notifyAdmins(message: string): Promise<void> {
  try {
    const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
    if (admins.length > 0) {
      await db.insert(notificationsTable).values(
        admins.map(a => ({
          userId: a.id,
          message,
          type: "backup",
          read: false,
        }))
      );
    }
  } catch {
    // don't fail
  }
}

async function rotateOldBackups(): Promise<void> {
  try {
    const all = await db.select().from(backupsTable)
      .where(eq(backupsTable.status, "completed"))
      .orderBy(desc(backupsTable.createdAt));

    if (all.length > KEEP_BACKUPS) {
      const toDelete = all.slice(KEEP_BACKUPS);
      for (const b of toDelete) {
        try { fs.unlinkSync(b.filePath); } catch { /* file may not exist */ }
        await db.delete(backupsTable).where(eq(backupsTable.id, b.id));
      }
    }
  } catch {
    // non-critical
  }
}

export async function runBackup(createdBy?: number): Promise<typeof backupsTable.$inferSelect> {
  await ensureBackupDir();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${timestamp}.sql`;
  const filePath = path.join(BACKUP_DIR, filename);

  const [record] = await db.insert(backupsTable).values({
    filename,
    filePath,
    status: "running",
    createdBy: createdBy ?? null,
  }).returning();

  const dbUrl = process.env.DATABASE_URL ?? "";
  try {
    await execAsync(`pg_dump "${dbUrl}" -f "${filePath}" --no-owner --no-acl`);

    const stats = fs.statSync(filePath);
    await db.update(backupsTable).set({
      status: "completed",
      sizeBytes: stats.size,
    }).where(eq(backupsTable.id, record.id));

    await rotateOldBackups();
    await notifyAdmins(`✅ Database backup completed: ${filename}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.update(backupsTable).set({
      status: "failed",
      errorMessage: msg.slice(0, 500),
    }).where(eq(backupsTable.id, record.id));

    await notifyAdmins(`❌ Database backup FAILED: ${msg.slice(0, 100)}`);
  }

  const [updated] = await db.select().from(backupsTable).where(eq(backupsTable.id, record.id));
  return updated;
}

// Schedule daily backup at 02:00
cron.schedule("0 2 * * *", () => {
  runBackup().catch(() => {});
});

router.get("/backups", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const backups = await db.select().from(backupsTable).orderBy(desc(backupsTable.createdAt)).limit(50);
  res.json(backups);
});

router.post("/backups", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const auth = (req as AuthReq).auth;

  await logAudit({
    userId: auth.userId,
    userRole: auth.role,
    action: "Triggered Manual Backup",
    entityType: "backup",
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  // Start in background, respond immediately with pending record
  const [pending] = await db.insert(backupsTable).values({
    filename: `manual-${Date.now()}.sql`,
    filePath: "",
    status: "running",
    createdBy: auth.userId,
  }).returning();

  res.json(pending);

  // Run async (don't await in request)
  runBackup(auth.userId).catch(() => {});
});

router.post("/backups/:id/restore", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const auth = (req as AuthReq).auth;
  const id = parseId(req.params.id);

  const [backup] = await db.select().from(backupsTable).where(eq(backupsTable.id, id));
  if (!backup || backup.status !== "completed") {
    res.status(400).json({ error: "Backup not found or not completed" });
    return;
  }

  if (!fs.existsSync(backup.filePath)) {
    res.status(400).json({ error: "Backup file not found on disk" });
    return;
  }

  await logAudit({
    userId: auth.userId,
    userRole: auth.role,
    action: "Restored Database Backup",
    entityType: "backup",
    entityId: id,
    description: `Restored from backup: ${backup.filename}`,
    ipAddress: req.ip,
  });

  const dbUrl = process.env.DATABASE_URL ?? "";
  try {
    await execAsync(`psql "${dbUrl}" -f "${backup.filePath}"`);
    await db.update(backupsTable).set({
      restoredAt: new Date(),
      restoredBy: auth.userId,
    }).where(eq(backupsTable.id, id));

    res.json({ success: true, message: `Restored from ${backup.filename}` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg.slice(0, 200) });
  }
});

export default router;
