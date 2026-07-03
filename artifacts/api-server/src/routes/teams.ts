import { Router, type IRouter } from "express";
import { db, teamsTable, teamMembersTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(s, 10);
}

router.get("/teams", requireAuth, async (req, res): Promise<void> => {
  const teams = await db.select().from(teamsTable).orderBy(teamsTable.createdAt);
  const members = await db.select().from(teamMembersTable);
  const users = await db.select({ id: usersTable.id, name: usersTable.name, role: usersTable.role }).from(usersTable);
  const userMap = new Map(users.map(u => [u.id, u]));

  res.json(teams.map(t => ({
    id: t.id, name: t.name, description: t.description,
    createdBy: t.createdBy, createdAt: t.createdAt.toISOString(),
    members: members.filter(m => m.teamId === t.id).map(m => ({
      userId: m.userId,
      name: userMap.get(m.userId)?.name ?? "Unknown",
      role: userMap.get(m.userId)?.role ?? "worker",
    })),
  })));
});

router.post("/teams", requireAuth, async (req, res): Promise<void> => {
  const { userId } = (req as typeof req & { auth: { userId: number; role: string } }).auth;
  const { name, description, memberIds } = req.body as { name: string; description?: string; memberIds?: number[] };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }

  const [team] = await db.insert(teamsTable).values({ name: name.trim(), description: description ?? null, createdBy: userId }).returning();

  if (memberIds?.length) {
    await db.insert(teamMembersTable).values(memberIds.map(uid => ({ teamId: team.id, userId: uid }))).onConflictDoNothing();
  }

  res.status(201).json({ id: team.id, name: team.name, description: team.description, createdBy: team.createdBy, createdAt: team.createdAt.toISOString(), members: [] });
});

router.put("/teams/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const { name, description } = req.body as { name?: string; description?: string };
  const updates: Partial<typeof teamsTable.$inferInsert> = {};
  if (name) updates.name = name.trim();
  if (description !== undefined) updates.description = description;

  const [team] = await db.update(teamsTable).set(updates).where(eq(teamsTable.id, id)).returning();
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }
  res.json({ id: team.id, name: team.name, description: team.description, createdBy: team.createdBy, createdAt: team.createdAt.toISOString() });
});

router.delete("/teams/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [deleted] = await db.delete(teamsTable).where(eq(teamsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Team not found" }); return; }
  res.sendStatus(204);
});

router.get("/teams/:id/members", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const members = await db.select({ id: teamMembersTable.id, userId: teamMembersTable.userId, name: usersTable.name, role: usersTable.role })
    .from(teamMembersTable)
    .leftJoin(usersTable, eq(teamMembersTable.userId, usersTable.id))
    .where(eq(teamMembersTable.teamId, id));
  res.json(members.map(m => ({ id: m.id, userId: m.userId, name: m.name ?? "Unknown", role: m.role ?? "worker" })));
});

router.post("/teams/:id/members", requireAuth, async (req, res): Promise<void> => {
  const teamId = parseId(req.params.id);
  const { userId: memberId } = req.body as { userId: number };
  if (!memberId) { res.status(400).json({ error: "userId is required" }); return; }
  await db.insert(teamMembersTable).values({ teamId, userId: memberId }).onConflictDoNothing();
  res.sendStatus(201);
});

router.delete("/teams/:id/members/:userId", requireAuth, async (req, res): Promise<void> => {
  const teamId = parseId(req.params.id);
  const memberId = parseId(req.params.userId);
  await db.delete(teamMembersTable).where(eq(teamMembersTable.teamId, teamId));
  res.sendStatus(204);
});

export default router;
