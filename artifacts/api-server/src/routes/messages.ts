import { Router, type IRouter } from "express";
import {
  db, conversationsTable, conversationMembersTable, messagesTable,
  messageReadsTable, teamMembersTable, usersTable, jobWorkersTable,
  notificationsTable, pushTokensTable, jobsTable, teamsTable,
} from "@workspace/db";
import { eq, and, inArray, desc, sql, ne } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(s, 10);
}

type AuthReq = typeof import("express").request & { auth: { userId: number; role: string; name?: string } };

async function sendPush(token: string, title: string, body: string, data?: Record<string, unknown>) {
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: token, title, body, data: data ?? {}, sound: "default" }),
    });
  } catch { /* best effort */ }
}

async function notifyConversationMembers(
  conversationId: number,
  senderId: number,
  senderName: string,
  messageText: string,
  convoName: string,
) {
  const members = await db.select().from(conversationMembersTable)
    .where(eq(conversationMembersTable.conversationId, conversationId));

  const recipientIds = members.filter(m => m.userId !== senderId).map(m => m.userId);
  if (!recipientIds.length) return;

  await db.insert(notificationsTable).values(recipientIds.map(uid => ({
    userId: uid,
    message: `${senderName}: ${messageText.slice(0, 100)}`,
    type: "new_message",
    referenceType: "conversation",
    referenceId: conversationId,
    metadata: JSON.stringify({ conversationId, convoName }),
  })));

  const tokens = await db.select().from(pushTokensTable).where(inArray(pushTokensTable.userId, recipientIds));
  await Promise.all(tokens.map(t => sendPush(t.token, convoName, `${senderName}: ${messageText.slice(0, 60)}`, { conversationId })));
}

router.get("/conversations", requireAuth, async (req, res): Promise<void> => {
  const { userId, role } = (req as unknown as AuthReq).auth;

  let memberRows;
  if (role === "admin") {
    memberRows = await db.select({ conversationId: conversationMembersTable.conversationId })
      .from(conversationMembersTable);
    const uniqueIds = [...new Set(memberRows.map(r => r.conversationId))];
    memberRows = uniqueIds.map(id => ({ conversationId: id }));
  } else {
    memberRows = await db.select({ conversationId: conversationMembersTable.conversationId })
      .from(conversationMembersTable)
      .where(eq(conversationMembersTable.userId, userId));
  }

  const convIds = memberRows.map(r => r.conversationId);
  if (!convIds.length) { res.json([]); return; }

  const convos = await db.select().from(conversationsTable).where(inArray(conversationsTable.id, convIds));
  const allMembers = await db.select({ conversationId: conversationMembersTable.conversationId, userId: conversationMembersTable.userId, name: usersTable.name })
    .from(conversationMembersTable)
    .leftJoin(usersTable, eq(conversationMembersTable.userId, usersTable.id))
    .where(inArray(conversationMembersTable.conversationId, convIds));

  const lastMessages = await db.select().from(messagesTable)
    .where(and(inArray(messagesTable.conversationId, convIds), sql`${messagesTable.deletedAt} IS NULL`))
    .orderBy(desc(messagesTable.createdAt));

  const lastMsgMap = new Map<number, typeof lastMessages[number]>();
  for (const m of lastMessages) {
    if (!lastMsgMap.has(m.conversationId)) lastMsgMap.set(m.conversationId, m);
  }

  const unreadCounts = await db.select({
    conversationId: messagesTable.conversationId,
    count: sql<number>`count(*)::int`,
  }).from(messagesTable)
    .where(and(
      inArray(messagesTable.conversationId, convIds),
      sql`${messagesTable.deletedAt} IS NULL`,
      sql`${messagesTable.id} NOT IN (SELECT message_id FROM message_reads WHERE user_id = ${userId})`,
      ne(messagesTable.senderId, userId),
    ))
    .groupBy(messagesTable.conversationId);

  const unreadMap = new Map(unreadCounts.map(u => [u.conversationId, u.count]));

  res.json(convos.map(c => {
    const lastMsg = lastMsgMap.get(c.id);
    return {
      id: c.id, type: c.type, name: c.name,
      jobId: c.jobId ?? null, teamId: c.teamId ?? null,
      createdAt: c.createdAt.toISOString(),
      members: allMembers.filter(m => m.conversationId === c.id).map(m => ({ userId: m.userId, name: m.name ?? "Unknown" })),
      lastMessage: lastMsg ? {
        id: lastMsg.id,
        type: lastMsg.type,
        content: lastMsg.type === "text" ? lastMsg.content : `[${lastMsg.type}]`,
        senderId: lastMsg.senderId,
        createdAt: lastMsg.createdAt.toISOString(),
      } : null,
      unreadCount: unreadMap.get(c.id) ?? 0,
    };
  }));
});

router.post("/conversations", requireAuth, async (req, res): Promise<void> => {
  const { userId, role } = (req as unknown as AuthReq).auth;
  const { type, name, jobId, teamId, memberIds } = req.body as {
    type: "direct" | "job_chat" | "team_chat";
    name?: string;
    jobId?: number;
    teamId?: number;
    memberIds?: number[];
  };

  if (!["direct", "job_chat", "team_chat"].includes(type)) {
    res.status(400).json({ error: "Invalid type" }); return;
  }

  if (type === "direct" && memberIds?.length !== 1) {
    res.status(400).json({ error: "Direct message requires exactly 1 other user" }); return;
  }

  if (type === "direct") {
    const otherId = memberIds![0];
    const existing = await db.select({ conversationId: conversationMembersTable.conversationId })
      .from(conversationMembersTable)
      .where(eq(conversationMembersTable.userId, userId));
    const existingIds = existing.map(e => e.conversationId);

    if (existingIds.length) {
      const directConvos = await db.select().from(conversationsTable)
        .where(and(inArray(conversationsTable.id, existingIds), eq(conversationsTable.type, "direct")));
      for (const c of directConvos) {
        const members = await db.select().from(conversationMembersTable).where(eq(conversationMembersTable.conversationId, c.id));
        const memberUserIds = members.map(m => m.userId);
        if (memberUserIds.includes(userId) && memberUserIds.includes(otherId) && memberUserIds.length === 2) {
          res.json({ id: c.id, type: c.type, name: c.name, jobId: null, teamId: null, createdAt: c.createdAt.toISOString(), members: [], lastMessage: null, unreadCount: 0 });
          return;
        }
      }
    }
  }

  const [convo] = await db.insert(conversationsTable).values({
    type, name: name ?? null, jobId: jobId ?? null, teamId: teamId ?? null, createdBy: userId,
  }).returning();

  const allMemberIds = [...new Set([userId, ...(memberIds ?? [])])];
  await db.insert(conversationMembersTable).values(allMemberIds.map(uid => ({ conversationId: convo.id, userId: uid }))).onConflictDoNothing();

  res.status(201).json({ id: convo.id, type: convo.type, name: convo.name, jobId: convo.jobId ?? null, teamId: convo.teamId ?? null, createdAt: convo.createdAt.toISOString(), members: [], lastMessage: null, unreadCount: 0 });
});

router.get("/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const { userId } = (req as unknown as AuthReq).auth;
  const convId = parseId(req.params.id);
  const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10), 200);
  const before = req.query.before ? parseInt(String(req.query.before), 10) : undefined;

  const whereClause = before
    ? and(eq(messagesTable.conversationId, convId), sql`${messagesTable.deletedAt} IS NULL`, sql`${messagesTable.id} < ${before}`)
    : and(eq(messagesTable.conversationId, convId), sql`${messagesTable.deletedAt} IS NULL`);

  const msgs = await db.select().from(messagesTable).where(whereClause).orderBy(desc(messagesTable.createdAt)).limit(limit);

  const senderIds = [...new Set(msgs.map(m => m.senderId).filter(Boolean))] as number[];
  const senders = senderIds.length ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, senderIds)) : [];
  const senderMap = new Map(senders.map(s => [s.id, s.name]));

  const msgIds = msgs.map(m => m.id);
  const reads = msgIds.length ? await db.select().from(messageReadsTable).where(inArray(messageReadsTable.messageId, msgIds)) : [];

  await db.insert(messageReadsTable).values(msgIds.filter(id => {
    const myRead = reads.find(r => r.messageId === id && r.userId === userId);
    return !myRead;
  }).map(id => ({ messageId: id, userId }))).onConflictDoNothing().catch(() => {});

  res.json(msgs.reverse().map(m => ({
    id: m.id, conversationId: m.conversationId, senderId: m.senderId,
    senderName: m.senderId ? (senderMap.get(m.senderId) ?? "Unknown") : "System",
    type: m.type, content: m.content, fileName: m.fileName, fileMime: m.fileMime,
    latitude: m.latitude ? Number(m.latitude) : null,
    longitude: m.longitude ? Number(m.longitude) : null,
    createdAt: m.createdAt.toISOString(),
    readBy: reads.filter(r => r.messageId === m.id).map(r => ({ userId: r.userId, readAt: r.readAt.toISOString() })),
  })));
});

router.post("/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const { userId } = (req as unknown as AuthReq).auth;
  const convId = parseId(req.params.id);
  const { type = "text", content, fileName, fileMime, latitude, longitude } = req.body as {
    type?: string; content: string; fileName?: string; fileMime?: string;
    latitude?: number; longitude?: number;
  };

  if (!content?.trim() && type === "text") { res.status(400).json({ error: "content is required" }); return; }
  if (!["text", "image", "document", "location"].includes(type)) { res.status(400).json({ error: "Invalid message type" }); return; }

  const [msg] = await db.insert(messagesTable).values({
    conversationId: convId, senderId: userId,
    type: type as "text" | "image" | "document" | "location",
    content: content ?? "",
    fileName: fileName ?? null, fileMime: fileMime ?? null,
    latitude: latitude != null ? String(latitude) : null,
    longitude: longitude != null ? String(longitude) : null,
  }).returning();

  await db.insert(messageReadsTable).values({ messageId: msg.id, userId }).onConflictDoNothing();

  const [sender] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
  const [convo] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId));
  const convoName = convo?.name ?? (type === "direct" ? (sender?.name ?? "Message") : "New Message");

  const displayContent = type === "text" ? content : `[${type}]`;
  await notifyConversationMembers(convId, userId, sender?.name ?? "Someone", displayContent, convoName);

  res.status(201).json({
    id: msg.id, conversationId: msg.conversationId, senderId: msg.senderId,
    senderName: sender?.name ?? "Unknown",
    type: msg.type, content: msg.content, fileName: msg.fileName, fileMime: msg.fileMime,
    latitude: msg.latitude ? Number(msg.latitude) : null,
    longitude: msg.longitude ? Number(msg.longitude) : null,
    createdAt: msg.createdAt.toISOString(), readBy: [],
  });
});

router.delete("/conversations/:convId/messages/:msgId", requireAuth, async (req, res): Promise<void> => {
  const { userId } = (req as unknown as AuthReq).auth;
  const msgId = parseId(req.params.msgId);
  const [msg] = await db.select().from(messagesTable).where(and(eq(messagesTable.id, msgId), eq(messagesTable.senderId, userId)));
  if (!msg) { res.status(404).json({ error: "Message not found" }); return; }
  await db.update(messagesTable).set({ deletedAt: new Date() }).where(eq(messagesTable.id, msgId));
  res.sendStatus(204);
});

router.get("/messages/unread-count", requireAuth, async (req, res): Promise<void> => {
  const { userId } = (req as unknown as AuthReq).auth;
  const memberRows = await db.select({ conversationId: conversationMembersTable.conversationId })
    .from(conversationMembersTable).where(eq(conversationMembersTable.userId, userId));
  const convIds = memberRows.map(r => r.conversationId);
  if (!convIds.length) { res.json({ count: 0 }); return; }

  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(messagesTable)
    .where(and(
      inArray(messagesTable.conversationId, convIds),
      sql`${messagesTable.deletedAt} IS NULL`,
      sql`${messagesTable.id} NOT IN (SELECT message_id FROM message_reads WHERE user_id = ${userId})`,
      ne(messagesTable.senderId, userId),
    ));

  res.json({ count: row?.count ?? 0 });
});

router.post("/push-tokens", requireAuth, async (req, res): Promise<void> => {
  const { userId } = (req as unknown as AuthReq).auth;
  const { token, platform } = req.body as { token: string; platform?: "ios" | "android" };
  if (!token) { res.status(400).json({ error: "token is required" }); return; }

  await db.insert(pushTokensTable).values({ userId, token, platform: platform ?? null, updatedAt: new Date() })
    .onConflictDoUpdate({ target: pushTokensTable.userId, set: { token, platform: platform ?? null, updatedAt: new Date() } });

  res.sendStatus(200);
});

router.post("/conversations/job/:jobId", requireAuth, async (req, res): Promise<void> => {
  const jobId = parseId(req.params.jobId);
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }

  const existing = await db.select().from(conversationsTable)
    .where(and(eq(conversationsTable.type, "job_chat"), eq(conversationsTable.jobId, jobId)));

  if (existing.length) {
    res.json({ id: existing[0].id, type: existing[0].type, name: existing[0].name, jobId: existing[0].jobId, teamId: null, createdAt: existing[0].createdAt.toISOString(), members: [], lastMessage: null, unreadCount: 0 });
    return;
  }

  const [convo] = await db.insert(conversationsTable).values({
    type: "job_chat", name: job.clientName + (job.projectName ? ` – ${job.projectName}` : ""), jobId,
  }).returning();

  const workers = await db.select({ userId: jobWorkersTable.userId }).from(jobWorkersTable).where(eq(jobWorkersTable.jobId, jobId));
  const memberIds = [...new Set([job.projectManagerId, ...workers.map(w => w.userId)].filter(Boolean))] as number[];
  if (memberIds.length) {
    await db.insert(conversationMembersTable).values(memberIds.map(uid => ({ conversationId: convo.id, userId: uid }))).onConflictDoNothing();
  }

  res.status(201).json({ id: convo.id, type: convo.type, name: convo.name, jobId: convo.jobId, teamId: null, createdAt: convo.createdAt.toISOString(), members: [], lastMessage: null, unreadCount: 0 });
});

export default router;
