import { Router, type IRouter } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(s, 10);
}

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const { userId } = (req as typeof req & { auth: { userId: number } }).auth;
  const notes = await db.select().from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(notificationsTable.createdAt);
  res.json(notes.map(n => ({
    id: n.id, userId: n.userId, message: n.message, type: n.type,
    read: n.read, jobId: n.jobId ?? null, createdAt: n.createdAt.toISOString(),
  })));
});

router.put("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const { userId } = (req as typeof req & { auth: { userId: number } }).auth;
  const [note] = await db.update(notificationsTable)
    .set({ read: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId)))
    .returning();
  if (!note) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  res.json({
    id: note.id, userId: note.userId, message: note.message, type: note.type,
    read: note.read, jobId: note.jobId ?? null, createdAt: note.createdAt.toISOString(),
  });
});

export default router;
