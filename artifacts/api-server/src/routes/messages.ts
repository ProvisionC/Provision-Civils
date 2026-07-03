import { Router, type IRouter } from "express";
import {
  db, conversationsTable, conversationMembersTable, messagesTable,
  messageReadsTable, teamMembersTable, usersTable, jobWorkersTable,
  notificationsTable, pushTokensTable, jobsTable, teamsTable,
} from "@workspace/db";
import { eq, and, inArray, desc, sql, ne, like, gte, lte, or } from "drizzle-orm";
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
      body: JSON.stringify({ to: token, title, body, data: data ?? {}, sound: "default", priority: "high" }),
    });
  } catch { /* best effort */ }
}

async function notifyConversationMembers(
  conversationId: number,
  senderId: number,
  senderName: string,
  messageText: string,
  convoName: string,
  mentionedIds?: number[],
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
  }))).onConflictDoNothing();

  const tokens = await db.select().from(pushTokensTable).where(inArray(pushTokensTable.userId, recipientIds));
  await Promise.all(tokens.map(t => {
    const isMentioned = mentionedIds?.includes(t.userId);
    return sendPush(t.token, isMentioned ? `@mention — ${convoName}` : convoName,
      `${senderName}: ${messageText.slice(0, 60)}`, { conversationId });
  }));
}

function formatMessage(m: any, senderMap: Map<number, string>, reads: any[], allUsers: Map<number, string>) {
  return {
    id: m.id, conversationId: m.conversationId, senderId: m.senderId,
    senderName: m.senderId ? (senderMap.get(m.senderId) ?? "Unknown") : "System",
    type: m.type, content: m.content, fileName: m.fileName, fileMime: m.fileMime,
    latitude: m.latitude ? Number(m.latitude) : null,
    longitude: m.longitude ? Number(m.longitude) : null,
    replyToId: m.replyToId ?? null,
    replyTo: null,
    pinnedAt: m.pinnedAt?.toISOString() ?? null,
    pinnedBy: m.pinnedBy ?? null,
    editedAt: m.editedAt?.toISOString() ?? null,
    mentions: (m.mentions as number[] | null) ?? [],
    voiceDuration: m.voiceDuration ?? null,
    reactions: (m.reactions as Record<string, number[]> | null) ?? {},
    createdAt: m.createdAt.toISOString(),
    readBy: reads
      .filter(r => r.messageId === m.id)
      .map(r => ({ userId: r.userId, userName: allUsers.get(r.userId) ?? "Unknown", readAt: r.readAt.toISOString() })),
  };
}

// ── LIST CONVERSATIONS ──────────────────────────────────────────────────────

router.get("/conversations", requireAuth, async (req, res): Promise<void> => {
  const { userId, role } = (req as unknown as AuthReq).auth;

  let memberRows: { conversationId: number }[];
  if (role === "admin") {
    const allMembers = await db.select({ conversationId: conversationMembersTable.conversationId }).from(conversationMembersTable);
    const uniqueIds = [...new Set(allMembers.map(r => r.conversationId))];
    memberRows = uniqueIds.map(id => ({ conversationId: id }));
  } else {
    memberRows = await db.select({ conversationId: conversationMembersTable.conversationId })
      .from(conversationMembersTable)
      .where(eq(conversationMembersTable.userId, userId));
  }

  const convIds = memberRows.map(r => r.conversationId);
  if (!convIds.length) { res.json([]); return; }

  const convos = await db.select().from(conversationsTable).where(inArray(conversationsTable.id, convIds));
  const allMembersData = await db.select({ conversationId: conversationMembersTable.conversationId, userId: conversationMembersTable.userId, name: usersTable.name })
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
      isLocked: c.isLocked, isArchived: c.isArchived,
      createdAt: c.createdAt.toISOString(),
      members: allMembersData.filter(m => m.conversationId === c.id).map(m => ({ userId: m.userId, name: m.name ?? "Unknown" })),
      lastMessage: lastMsg ? {
        id: lastMsg.id, type: lastMsg.type,
        content: lastMsg.type === "text" ? lastMsg.content : `[${lastMsg.type}]`,
        senderId: lastMsg.senderId, createdAt: lastMsg.createdAt.toISOString(),
      } : null,
      unreadCount: unreadMap.get(c.id) ?? 0,
    };
  }));
});

// ── CREATE CONVERSATION ──────────────────────────────────────────────────────

router.post("/conversations", requireAuth, async (req, res): Promise<void> => {
  const { userId } = (req as unknown as AuthReq).auth;
  const { type, name, jobId, teamId, memberIds } = req.body as {
    type: "direct" | "job_chat" | "team_chat"; name?: string; jobId?: number; teamId?: number; memberIds?: number[];
  };

  if (!["direct", "job_chat", "team_chat"].includes(type)) { res.status(400).json({ error: "Invalid type" }); return; }
  if (type === "direct" && memberIds?.length !== 1) { res.status(400).json({ error: "Direct message requires exactly 1 other user" }); return; }

  if (type === "direct") {
    const otherId = memberIds![0];
    const existing = await db.select({ conversationId: conversationMembersTable.conversationId })
      .from(conversationMembersTable).where(eq(conversationMembersTable.userId, userId));
    const existingIds = existing.map(e => e.conversationId);
    if (existingIds.length) {
      const directConvos = await db.select().from(conversationsTable)
        .where(and(inArray(conversationsTable.id, existingIds), eq(conversationsTable.type, "direct")));
      for (const c of directConvos) {
        const members = await db.select().from(conversationMembersTable).where(eq(conversationMembersTable.conversationId, c.id));
        const ids = members.map(m => m.userId);
        if (ids.includes(userId) && ids.includes(otherId) && ids.length === 2) {
          res.json({ id: c.id, type: c.type, name: c.name, jobId: null, teamId: null, isLocked: c.isLocked, isArchived: c.isArchived, createdAt: c.createdAt.toISOString(), members: [], lastMessage: null, unreadCount: 0 });
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

  res.status(201).json({ id: convo.id, type: convo.type, name: convo.name, jobId: convo.jobId ?? null, teamId: convo.teamId ?? null, isLocked: convo.isLocked, isArchived: convo.isArchived, createdAt: convo.createdAt.toISOString(), members: [], lastMessage: null, unreadCount: 0 });
});

// ── LIST MESSAGES ──────────────────────────────────────────────────────────

router.get("/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const { userId } = (req as unknown as AuthReq).auth;
  const convId = parseId(req.params.id);
  const limit = Math.min(parseInt(String(req.query.limit ?? "60"), 10), 200);
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

  // Fetch usernames for read receipts
  const readerIds = [...new Set(reads.map(r => r.userId))];
  const readers = readerIds.length ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, readerIds)) : [];
  const readerMap = new Map(readers.map(s => [s.id, s.name ?? "Unknown"]));

  // Mark all as read by current user — guard against empty array (Drizzle throws if values([]))
  const unreadIds = msgIds.filter(id => !reads.find(r => r.messageId === id && r.userId === userId));
  if (unreadIds.length > 0) {
    await db.insert(messageReadsTable).values(unreadIds.map(id => ({ messageId: id, userId }))).onConflictDoNothing().catch(() => {});
  }

  // Fetch reply-to messages
  const replyIds = [...new Set(msgs.map(m => m.replyToId).filter(Boolean))] as number[];
  const replyMsgs = replyIds.length ? await db.select().from(messagesTable).where(inArray(messagesTable.id, replyIds)) : [];
  const replyMap = new Map(replyMsgs.map(m => [m.id, m]));

  res.json(msgs.reverse().map(m => {
    const replyTo = m.replyToId ? replyMap.get(m.replyToId) : null;
    const result = formatMessage(m, senderMap, reads, readerMap);
    if (replyTo) {
      result.replyTo = {
        id: replyTo.id, content: replyTo.content, type: replyTo.type,
        senderName: replyTo.senderId ? (senderMap.get(replyTo.senderId) ?? "Unknown") : "System",
      } as any;
    }
    return result;
  }));
});

// ── SEND MESSAGE ──────────────────────────────────────────────────────────

router.post("/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const { userId } = (req as unknown as AuthReq).auth;
  const convId = parseId(req.params.id);
  const { type = "text", content, fileName, fileMime, latitude, longitude, replyToId, mentions, voiceDuration } = req.body as {
    type?: string; content: string; fileName?: string; fileMime?: string;
    latitude?: number; longitude?: number; replyToId?: number; mentions?: number[]; voiceDuration?: number;
  };

  if (!content?.trim() && type === "text") { res.status(400).json({ error: "content is required" }); return; }
  const validTypes = ["text", "image", "document", "location", "voice", "video"];
  if (!validTypes.includes(type)) { res.status(400).json({ error: "Invalid message type" }); return; }

  const [convo] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId));
  if (convo?.isLocked) { res.status(403).json({ error: "Conversation is locked" }); return; }

  const [msg] = await db.insert(messagesTable).values({
    conversationId: convId, senderId: userId,
    type: type as any, content: content ?? "",
    fileName: fileName ?? null, fileMime: fileMime ?? null,
    latitude: latitude != null ? String(latitude) : null,
    longitude: longitude != null ? String(longitude) : null,
    replyToId: replyToId ?? null,
    mentions: mentions ?? [],
    voiceDuration: voiceDuration ?? null,
    reactions: {},
  }).returning();

  await db.insert(messageReadsTable).values({ messageId: msg.id, userId }).onConflictDoNothing();

  const [sender] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
  const convoName = convo?.name ?? "Message";
  const displayContent = type === "text" ? content : type === "voice" ? "🎤 Voice note" : type === "video" ? "🎥 Video" : `[${type}]`;
  await notifyConversationMembers(convId, userId, sender?.name ?? "Someone", displayContent, convoName, mentions);

  const senderMap = new Map([[userId, sender?.name ?? "Unknown"]]);
  res.status(201).json(formatMessage(msg, senderMap, [], new Map()));
});

// ── EDIT MESSAGE ──────────────────────────────────────────────────────────

router.put("/conversations/:convId/messages/:msgId", requireAuth, async (req, res): Promise<void> => {
  const { userId, role } = (req as unknown as AuthReq).auth;
  const msgId = parseId(req.params.msgId);
  const { content } = req.body as { content: string };

  if (!content?.trim()) { res.status(400).json({ error: "content required" }); return; }

  const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, msgId));
  if (!msg || msg.deletedAt) { res.status(404).json({ error: "Message not found" }); return; }

  const isAdmin = role === "admin";
  const isOwner = msg.senderId === userId;
  const withinEditWindow = isOwner && (Date.now() - msg.createdAt.getTime()) < 10 * 60 * 1000;

  if (!isAdmin && !withinEditWindow) { res.status(403).json({ error: "Cannot edit this message" }); return; }

  const [updated] = await db.update(messagesTable)
    .set({ content, editedAt: new Date() })
    .where(eq(messagesTable.id, msgId)).returning();

  const [sender] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, updated.senderId ?? 0));
  const senderMap = new Map(updated.senderId ? [[updated.senderId, sender?.name ?? "Unknown"]] : []);
  res.json(formatMessage(updated, senderMap, [], new Map()));
});

// ── DELETE MESSAGE ──────────────────────────────────────────────────────────

router.delete("/conversations/:convId/messages/:msgId", requireAuth, async (req, res): Promise<void> => {
  const { userId, role } = (req as unknown as AuthReq).auth;
  const msgId = parseId(req.params.msgId);

  const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, msgId));
  if (!msg || msg.deletedAt) { res.status(404).json({ error: "Message not found" }); return; }

  const isAdmin = role === "admin";
  if (!isAdmin && msg.senderId !== userId) { res.status(403).json({ error: "Not allowed" }); return; }

  await db.update(messagesTable).set({ deletedAt: new Date() }).where(eq(messagesTable.id, msgId));
  res.sendStatus(204);
});

// ── TOGGLE REACTION ──────────────────────────────────────────────────────────

router.post("/conversations/:convId/messages/:msgId/react", requireAuth, async (req, res): Promise<void> => {
  const { userId } = (req as unknown as AuthReq).auth;
  const msgId = parseId(req.params.msgId);
  const { emoji } = req.body as { emoji: string };

  if (!emoji) { res.status(400).json({ error: "emoji required" }); return; }

  const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, msgId));
  if (!msg || msg.deletedAt) { res.status(404).json({ error: "Message not found" }); return; }

  const reactions = (msg.reactions as Record<string, number[]> | null) ?? {};
  const users = reactions[emoji] ?? [];
  const idx = users.indexOf(userId);
  if (idx >= 0) {
    users.splice(idx, 1);
  } else {
    users.push(userId);
  }
  if (users.length === 0) delete reactions[emoji];
  else reactions[emoji] = users;

  await db.update(messagesTable).set({ reactions }).where(eq(messagesTable.id, msgId));
  res.json(reactions);
});

// ── PIN MESSAGE ──────────────────────────────────────────────────────────

router.post("/conversations/:convId/messages/:msgId/pin", requireAuth, async (req, res): Promise<void> => {
  const { userId, role } = (req as unknown as AuthReq).auth;
  const msgId = parseId(req.params.msgId);

  if (role !== "admin" && role !== "project_manager") { res.status(403).json({ error: "Admins only" }); return; }

  const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, msgId));
  if (!msg) { res.status(404).json({ error: "Not found" }); return; }

  const isPinned = !!msg.pinnedAt;
  const [updated] = await db.update(messagesTable)
    .set({ pinnedAt: isPinned ? null : new Date(), pinnedBy: isPinned ? null : userId })
    .where(eq(messagesTable.id, msgId)).returning();

  const [sender] = updated.senderId ? await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, updated.senderId)) : [{ name: "Unknown" }];
  const senderMap = new Map(updated.senderId ? [[updated.senderId, sender?.name ?? "Unknown"]] : []);
  res.json(formatMessage(updated, senderMap, [], new Map()));
});

// ── GET PINNED MESSAGES ──────────────────────────────────────────────────────

router.get("/conversations/:id/pinned", requireAuth, async (req, res): Promise<void> => {
  const convId = parseId(req.params.id);

  const msgs = await db.select().from(messagesTable)
    .where(and(eq(messagesTable.conversationId, convId), sql`${messagesTable.pinnedAt} IS NOT NULL`, sql`${messagesTable.deletedAt} IS NULL`))
    .orderBy(desc(messagesTable.pinnedAt));

  if (!msgs.length) { res.json([]); return; }

  const senderIds = [...new Set(msgs.map(m => m.senderId).filter(Boolean))] as number[];
  const senders = senderIds.length ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, senderIds)) : [];
  const senderMap = new Map(senders.map(s => [s.id, s.name]));

  res.json(msgs.map(m => formatMessage(m, senderMap, [], new Map())));
});

// ── LOCK CONVERSATION ──────────────────────────────────────────────────────────

router.put("/conversations/:id/lock", requireAuth, async (req, res): Promise<void> => {
  const { role } = (req as unknown as AuthReq).auth;
  if (role !== "admin" && role !== "project_manager") { res.status(403).json({ error: "Admins only" }); return; }

  const convId = parseId(req.params.id);
  const [convo] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId));
  if (!convo) { res.status(404).json({ error: "Not found" }); return; }

  const [updated] = await db.update(conversationsTable).set({ isLocked: !convo.isLocked }).where(eq(conversationsTable.id, convId)).returning();
  res.json({ id: updated.id, type: updated.type, isLocked: updated.isLocked, isArchived: updated.isArchived, name: updated.name, jobId: updated.jobId, teamId: updated.teamId, createdAt: updated.createdAt.toISOString(), members: [], lastMessage: null, unreadCount: 0 });
});

// ── ARCHIVE CONVERSATION ──────────────────────────────────────────────────────────

router.put("/conversations/:id/archive", requireAuth, async (req, res): Promise<void> => {
  const { role } = (req as unknown as AuthReq).auth;
  if (role !== "admin" && role !== "project_manager") { res.status(403).json({ error: "Admins only" }); return; }

  const convId = parseId(req.params.id);
  const [convo] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId));
  if (!convo) { res.status(404).json({ error: "Not found" }); return; }

  const [updated] = await db.update(conversationsTable).set({ isArchived: !convo.isArchived }).where(eq(conversationsTable.id, convId)).returning();
  res.json({ id: updated.id, type: updated.type, isLocked: updated.isLocked, isArchived: updated.isArchived, name: updated.name, jobId: updated.jobId, teamId: updated.teamId, createdAt: updated.createdAt.toISOString(), members: [], lastMessage: null, unreadCount: 0 });
});

// ── SEARCH MESSAGES ──────────────────────────────────────────────────────────

router.get("/messages/search", requireAuth, async (req, res): Promise<void> => {
  const { userId, role } = (req as unknown as AuthReq).auth;
  const { keyword, senderId, jobId, teamId, fileName: fileNameQ, dateFrom, dateTo, type: typeQ } = req.query as Record<string, string>;

  const memberRows = role === "admin"
    ? await db.select({ conversationId: conversationMembersTable.conversationId }).from(conversationMembersTable)
    : await db.select({ conversationId: conversationMembersTable.conversationId }).from(conversationMembersTable).where(eq(conversationMembersTable.userId, userId));
  const convIds = [...new Set(memberRows.map(r => r.conversationId))];
  if (!convIds.length) { res.json([]); return; }

  const conditions: any[] = [
    inArray(messagesTable.conversationId, convIds),
    sql`${messagesTable.deletedAt} IS NULL`,
  ];
  if (keyword) conditions.push(sql`${messagesTable.content} ILIKE ${'%' + keyword + '%'}`);
  if (senderId) conditions.push(eq(messagesTable.senderId, parseInt(senderId)));
  if (fileNameQ) conditions.push(sql`${messagesTable.fileName} ILIKE ${'%' + fileNameQ + '%'}`);
  if (typeQ) conditions.push(eq(messagesTable.type, typeQ as any));
  if (dateFrom) conditions.push(gte(messagesTable.createdAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(messagesTable.createdAt, new Date(dateTo + "T23:59:59Z")));

  if (jobId || teamId) {
    const convFilter = await db.select({ id: conversationsTable.id }).from(conversationsTable)
      .where(and(
        inArray(conversationsTable.id, convIds),
        ...(jobId ? [eq(conversationsTable.jobId, parseInt(jobId))] : []),
        ...(teamId ? [eq(conversationsTable.teamId, parseInt(teamId))] : []),
      ));
    const filteredIds = convFilter.map(c => c.id);
    if (!filteredIds.length) { res.json([]); return; }
    conditions.push(inArray(messagesTable.conversationId, filteredIds));
  }

  const msgs = await db.select().from(messagesTable)
    .where(and(...conditions))
    .orderBy(desc(messagesTable.createdAt))
    .limit(100);

  const senderIds = [...new Set(msgs.map(m => m.senderId).filter(Boolean))] as number[];
  const senders = senderIds.length ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, senderIds)) : [];
  const senderMap = new Map(senders.map(s => [s.id, s.name]));

  const convos = msgs.length ? await db.select({ id: conversationsTable.id, name: conversationsTable.name, type: conversationsTable.type })
    .from(conversationsTable).where(inArray(conversationsTable.id, [...new Set(msgs.map(m => m.conversationId))])) : [];
  const convoMap = new Map(convos.map(c => [c.id, c]));

  res.json(msgs.map(m => ({
    id: m.id, conversationId: m.conversationId,
    conversationName: convoMap.get(m.conversationId)?.name ?? `Conversation ${m.conversationId}`,
    conversationType: convoMap.get(m.conversationId)?.type ?? "direct",
    senderId: m.senderId,
    senderName: m.senderId ? (senderMap.get(m.senderId) ?? "Unknown") : "System",
    type: m.type, content: m.content, fileName: m.fileName,
    createdAt: m.createdAt.toISOString(),
  })));
});

// ── UNREAD COUNT ──────────────────────────────────────────────────────────

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

// ── REGISTER PUSH TOKEN ──────────────────────────────────────────────────────────

router.post("/push-tokens", requireAuth, async (req, res): Promise<void> => {
  const { userId } = (req as unknown as AuthReq).auth;
  const { token, platform } = req.body as { token: string; platform?: "ios" | "android" };
  if (!token) { res.status(400).json({ error: "token is required" }); return; }
  await db.insert(pushTokensTable).values({ userId, token, platform: platform ?? null, updatedAt: new Date() })
    .onConflictDoUpdate({ target: pushTokensTable.userId, set: { token, platform: platform ?? null, updatedAt: new Date() } });
  res.sendStatus(200);
});

// ── CREATE JOB CHAT ──────────────────────────────────────────────────────────

router.post("/conversations/job/:jobId", requireAuth, async (req, res): Promise<void> => {
  const { userId } = (req as unknown as AuthReq).auth;
  const jobId = parseId(req.params.jobId);
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }

  const existing = await db.select().from(conversationsTable)
    .where(and(eq(conversationsTable.type, "job_chat"), eq(conversationsTable.jobId, jobId)));

  if (existing.length) {
    const [e] = existing;
    res.json({ id: e.id, type: e.type, name: e.name, jobId: e.jobId, teamId: null, isLocked: e.isLocked, isArchived: e.isArchived, createdAt: e.createdAt.toISOString(), members: [], lastMessage: null, unreadCount: 0 });
    return;
  }

  const [convo] = await db.insert(conversationsTable).values({
    type: "job_chat", name: job.clientName + (job.projectName ? ` – ${job.projectName}` : ""), jobId, createdBy: userId,
  }).returning();

  const workers = await db.select({ workerId: jobWorkersTable.workerId }).from(jobWorkersTable).where(eq(jobWorkersTable.jobId, jobId));
  const memberIds = [...new Set([job.projectManagerId, ...workers.map(w => w.workerId)].filter(Boolean))] as number[];
  if (memberIds.length) {
    await db.insert(conversationMembersTable).values(memberIds.map(uid => ({ conversationId: convo.id, userId: uid }))).onConflictDoNothing();
  }

  res.status(201).json({ id: convo.id, type: convo.type, name: convo.name, jobId: convo.jobId, teamId: null, isLocked: convo.isLocked, isArchived: convo.isArchived, createdAt: convo.createdAt.toISOString(), members: [], lastMessage: null, unreadCount: 0 });
});

// ── EMERGENCY BROADCAST ──────────────────────────────────────────────────────────

router.post("/emergency-broadcast", requireAuth, async (req, res): Promise<void> => {
  const { userId, role, name: authName } = (req as unknown as AuthReq).auth;
  if (role !== "admin" && role !== "project_manager") { res.status(403).json({ error: "Admins only" }); return; }

  const { title, message } = req.body as { title: string; message: string };
  if (!title || !message) { res.status(400).json({ error: "title and message required" }); return; }

  const allUsers = await db.select({ id: usersTable.id }).from(usersTable).where(ne(usersTable.id, userId));

  await db.insert(notificationsTable).values(allUsers.map(u => ({
    userId: u.id, message: `🚨 ${title}: ${message}`, type: "server_offline",
    referenceType: "emergency" as any, referenceId: null as any,
    metadata: JSON.stringify({ title, message, priority: "emergency" }),
  }))).onConflictDoNothing();

  const tokens = await db.select().from(pushTokensTable).where(inArray(pushTokensTable.userId, allUsers.map(u => u.id)));
  await Promise.all(tokens.map(t => sendPush(t.token, `🚨 ${title}`, message, { type: "emergency" })));

  res.json({ sent: tokens.length });
});

export default router;
