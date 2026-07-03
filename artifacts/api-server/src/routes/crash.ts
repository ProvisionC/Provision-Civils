import { Router, type IRouter, type Request } from "express";
import { db, crashReportsTable, usersTable, notificationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireRole, type AuthPayload } from "../middlewares/auth.js";

const router: IRouter = Router();
type AuthReq = Request & { auth: AuthPayload };

function parseId(raw: string | string[]): number {
  return parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
}

router.post("/crash-reports", requireAuth, async (req, res): Promise<void> => {
  const auth = (req as AuthReq).auth;
  const body = req.body as {
    appVersion?: string;
    platform?: string;
    deviceInfo?: Record<string, unknown>;
    errorMessage: string;
    stackTrace?: string;
    extraContext?: Record<string, unknown>;
  };

  if (!body.errorMessage) {
    res.status(400).json({ error: "errorMessage required" });
    return;
  }

  const user = auth.userId
    ? (await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, auth.userId)))[0]
    : null;

  const [report] = await db.insert(crashReportsTable).values({
    userId: auth.userId,
    userName: user?.name ?? null,
    appVersion: body.appVersion ?? null,
    platform: body.platform ?? null,
    deviceInfo: body.deviceInfo ?? null,
    errorMessage: body.errorMessage,
    stackTrace: body.stackTrace ?? null,
    extraContext: body.extraContext ?? null,
  }).returning({ id: crashReportsTable.id });

  // Notify all admins
  try {
    const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
    if (admins.length > 0) {
      await db.insert(notificationsTable).values(
        admins.map(a => ({
          userId: a.id,
          message: `Crash report from ${user?.name ?? "Unknown"}: ${body.errorMessage.slice(0, 80)}`,
          type: "crash_report",
          read: false,
        }))
      );
    }
  } catch {
    // don't fail the crash report if notification fails
  }

  res.json({ id: report.id });
});

router.get("/crash-reports", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const { resolved } = req.query as { resolved?: string };

  const reports = await db.select().from(crashReportsTable)
    .where(resolved !== undefined ? eq(crashReportsTable.resolved, resolved === "true") : undefined)
    .orderBy(desc(crashReportsTable.createdAt))
    .limit(200);

  res.json(reports);
});

router.post("/crash-reports/:id/resolve", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  await db.update(crashReportsTable).set({ resolved: true }).where(eq(crashReportsTable.id, id));
  res.json({ success: true });
});

export default router;
