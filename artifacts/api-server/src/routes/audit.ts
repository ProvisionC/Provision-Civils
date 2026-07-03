import { Router, type IRouter, type Request } from "express";
import { db, auditLogsTable, usersTable } from "@workspace/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { requireAuth, requireRole, type AuthPayload } from "../middlewares/auth.js";

const router: IRouter = Router();

type AuthReq = Request & { auth: AuthPayload };

function parseId(raw: string | string[]): number {
  return parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
}

router.get("/audit-logs", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const { userId, action, entityType, dateFrom, dateTo, limit = "100", offset = "0" } = req.query as Record<string, string>;

  const conditions = [];
  if (userId) conditions.push(eq(auditLogsTable.userId, parseInt(userId)));
  if (action) conditions.push(eq(auditLogsTable.action, action));
  if (entityType) conditions.push(eq(auditLogsTable.entityType, entityType));
  if (dateFrom) conditions.push(gte(auditLogsTable.createdAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(auditLogsTable.createdAt, new Date(dateTo)));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db.select().from(auditLogsTable)
      .where(where)
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(parseInt(limit))
      .offset(parseInt(offset)),
    db.$count(auditLogsTable, where),
  ]);

  res.json({ data, total: Number(countResult) });
});

export default router;

export async function logAudit(params: {
  userId?: number;
  userName?: string;
  userRole?: string;
  action: string;
  entityType?: string;
  entityId?: number;
  description?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: string;
}): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      userId: params.userId ?? null,
      userName: params.userName ?? null,
      userRole: params.userRole ?? null,
      action: params.action,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      description: params.description ?? null,
      metadata: params.metadata ?? null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      deviceInfo: params.deviceInfo ?? null,
    });
  } catch {
    // audit logging must never crash the main request
  }
}
