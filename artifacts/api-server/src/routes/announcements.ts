import { Router, type IRouter } from "express";
import { Expo } from "expo-server-sdk";
import { db, announcementsTable, usersTable, pushTokensTable, notificationsTable } from "@workspace/db";
import { eq, desc, and, sql, inArray, ne } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();
const expo = new Expo();
type AuthReq = typeof import("express").request & { auth: { userId: number; role: string; name?: string } };

async function sendPush(token: string, title: string, body: string, data?: Record<string, unknown>) {
  try {
    if (!Expo.isExpoPushToken(token)) {
      console.error("[push] invalid expo push token format", { tokenPrefix: (token as string).slice(0, 12) });
      await db.delete(pushTokensTable).where(eq(pushTokensTable.token, token));
      return;
    }

    const tickets = await expo.sendPushNotificationsAsync([
      {
        to: token,
        title,
        body,
        data: data ?? {},
        sound: "default",
        priority: "high" as const,
      },
    ]);

    const [ticket] = tickets;
    if (ticket?.status === "ok") {
      console.log("[push] delivery success", { title, tokenPrefix: token.slice(0, 12) });
    } else if (ticket?.status === "error" && (ticket.details?.error === "DeviceNotRegistered" || ticket.details?.error === "InvalidCredentials")) {
      console.warn("[push] device unregistered, removing token", { tokenPrefix: token.slice(0, 12) });
      await db.delete(pushTokensTable).where(eq(pushTokensTable.token, token));
    } else {
      console.error("[push] delivery failed", { status: ticket?.status, message: ticket?.message });
    }
  } catch (error) {
    console.error("[push] delivery error", error);
  }
}

// ── LIST ANNOUNCEMENTS ──────────────────────────────────────────────────────────

router.get("/announcements", requireAuth, async (req, res): Promise<void> => {
  const announcements = await db.select({
    id: announcementsTable.id,
    title: announcementsTable.title,
    category: announcementsTable.category,
    content: announcementsTable.content,
    priority: announcementsTable.priority,
    createdBy: announcementsTable.createdBy,
    createdByName: usersTable.name,
    createdAt: announcementsTable.createdAt,
    expiresAt: announcementsTable.expiresAt,
  }).from(announcementsTable)
    .leftJoin(usersTable, eq(announcementsTable.createdBy, usersTable.id))
    .orderBy(desc(announcementsTable.createdAt));

  res.json(announcements.map(a => ({
    ...a,
    createdAt: a.createdAt.toISOString(),
    expiresAt: a.expiresAt?.toISOString() ?? null,
  })));
});

// ── CREATE ANNOUNCEMENT ──────────────────────────────────────────────────────────

router.post("/announcements", requireAuth, async (req, res): Promise<void> => {
  const { userId, role } = (req as unknown as AuthReq).auth;
  if (role !== "admin" && role !== "project_manager") { res.status(403).json({ error: "Admins only" }); return; }

  const { title, category = "general", content, priority = "normal", expiresAt } = req.body as {
    title: string; category?: string; content: string; priority?: string; expiresAt?: string;
  };
  if (!title || !content) { res.status(400).json({ error: "title and content required" }); return; }

  const [ann] = await db.insert(announcementsTable).values({
    title, category: category as any, content, priority: priority as any,
    createdBy: userId,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  }).returning();

  // Notify all users
  const allUsers = await db.select({ id: usersTable.id }).from(usersTable).where(ne(usersTable.id, userId));
  const catLabel = category.replace("_", " ");
  await db.insert(notificationsTable).values(allUsers.map(u => ({
    userId: u.id,
    message: `📢 ${catLabel}: ${title}`,
    type: "app_update",
    referenceType: "announcement" as any,
    referenceId: ann.id,
    metadata: JSON.stringify({ announcementId: ann.id, priority }),
  }))).onConflictDoNothing();

  if (priority === "emergency" || priority === "high") {
    const tokens = await db.select().from(pushTokensTable).where(inArray(pushTokensTable.userId, allUsers.map(u => u.id)));
    await Promise.all(tokens.map(t => sendPush(t.token, `📢 ${title}`, content.slice(0, 100), { announcementId: ann.id })));
  }

  const [creator] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
  res.status(201).json({ ...ann, createdByName: creator?.name ?? null, createdAt: ann.createdAt.toISOString(), expiresAt: ann.expiresAt?.toISOString() ?? null });
});

// ── DELETE ANNOUNCEMENT ──────────────────────────────────────────────────────────

router.delete("/announcements/:id", requireAuth, async (req, res): Promise<void> => {
  const { role } = (req as unknown as AuthReq).auth;
  if (role !== "admin" && role !== "project_manager") { res.status(403).json({ error: "Admins only" }); return; }

  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(announcementsTable).where(eq(announcementsTable.id, id));
  res.sendStatus(204);
});

export default router;
