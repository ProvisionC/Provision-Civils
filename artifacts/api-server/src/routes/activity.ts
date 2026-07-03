import { Router, type IRouter, type Request } from "express";
import { db, userSessionsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireRole, type AuthPayload } from "../middlewares/auth.js";

const router: IRouter = Router();
type AuthReq = Request & { auth: AuthPayload };

router.get("/activity", requireAuth, requireRole("admin", "supervisor"), async (req, res): Promise<void> => {
  const sessions = await db.select({
    userId: userSessionsTable.userId,
    isOnline: userSessionsTable.isOnline,
    lastSeenAt: userSessionsTable.lastSeenAt,
    platform: userSessionsTable.platform,
    appVersion: userSessionsTable.appVersion,
    userName: usersTable.name,
    userRole: usersTable.role,
  })
    .from(userSessionsTable)
    .leftJoin(usersTable, eq(userSessionsTable.userId, usersTable.id))
    .orderBy(desc(userSessionsTable.lastSeenAt));

  res.json(sessions.map(s => ({
    userId: s.userId,
    userName: s.userName ?? "Unknown",
    userRole: s.userRole ?? "worker",
    isOnline: s.isOnline,
    lastSeenAt: s.lastSeenAt.toISOString(),
    platform: s.platform ?? null,
    appVersion: s.appVersion ?? null,
  })));
});

router.post("/activity/heartbeat", requireAuth, async (req, res): Promise<void> => {
  const auth = (req as AuthReq).auth;
  const { platform, appVersion, deviceInfo } = req.body as {
    platform?: string;
    appVersion?: string;
    deviceInfo?: string;
  };

  const now = new Date();
  await db
    .insert(userSessionsTable)
    .values({
      userId: auth.userId,
      isOnline: true,
      lastSeenAt: now,
      platform: platform ?? null,
      appVersion: appVersion ?? null,
      deviceInfo: deviceInfo ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userSessionsTable.userId,
      set: {
        isOnline: true,
        lastSeenAt: now,
        platform: platform ?? null,
        appVersion: appVersion ?? null,
        deviceInfo: deviceInfo ?? null,
        updatedAt: now,
      },
    });

  res.json({ ok: true });
});

export async function markUserOffline(userId: number): Promise<void> {
  try {
    await db
      .update(userSessionsTable)
      .set({ isOnline: false, updatedAt: new Date() })
      .where(eq(userSessionsTable.userId, userId));
  } catch {
    // non-critical
  }
}

export default router;
