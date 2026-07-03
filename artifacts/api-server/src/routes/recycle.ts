import { Router, type IRouter, type Request } from "express";
import { db, jobsTable, clientsTable, usersTable, invoicesTable, jobPhotosTable } from "@workspace/db";
import { eq, isNotNull } from "drizzle-orm";
import { requireAuth, requireRole, type AuthPayload } from "../middlewares/auth.js";
import { logAudit } from "./audit.js";

const router: IRouter = Router();
type AuthReq = Request & { auth: AuthPayload };

function parseId(raw: string | string[]): number {
  return parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
}

type RecycleType = "job" | "client" | "employee" | "invoice" | "photo";

function tableFor(type: RecycleType) {
  switch (type) {
    case "job": return jobsTable;
    case "client": return clientsTable;
    case "employee": return usersTable;
    case "invoice": return invoicesTable;
    case "photo": return jobPhotosTable;
  }
}

function nameFor(type: RecycleType, row: Record<string, unknown>): string {
  switch (type) {
    case "job": return String(row.jobNumber ?? row.id ?? "");
    case "client": return String(row.companyName ?? row.id ?? "");
    case "employee": return String(row.name ?? row.id ?? "");
    case "invoice": return String(row.invoiceNumber ?? row.id ?? "");
    case "photo": return String(row.caption ?? `Photo #${row.id}`);
  }
}

router.get("/recycle-bin", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const { type } = req.query as { type?: RecycleType };

  const items: Array<{ id: number; type: string; name: string; deletedAt: string; metadata: unknown }> = [];

  const types: RecycleType[] = type ? [type] : ["job", "client", "employee", "invoice", "photo"];

  for (const t of types) {
    const table = tableFor(t);
    const rows = await db.select().from(table as typeof jobsTable).where(isNotNull((table as typeof jobsTable).deletedAt));
    for (const row of rows) {
      items.push({
        id: row.id,
        type: t,
        name: nameFor(t, row as Record<string, unknown>),
        deletedAt: ((row as Record<string, unknown>).deletedAt as Date).toISOString(),
        metadata: row,
      });
    }
  }

  items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  res.json(items);
});

router.post("/recycle-bin/:type/:id/restore", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const auth = (req as AuthReq).auth;
  const type = req.params.type as RecycleType;
  const id = parseId(req.params.id);
  const table = tableFor(type);

  await db.update(table as typeof jobsTable).set({ deletedAt: null }).where(eq((table as typeof jobsTable).id, id));

  await logAudit({
    userId: auth.userId,
    userRole: auth.role,
    action: `Restored ${type}`,
    entityType: type,
    entityId: id,
    description: `Restored deleted ${type} #${id} from recycle bin`,
    ipAddress: req.ip,
  });

  res.json({ success: true });
});

router.delete("/recycle-bin/:type/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const auth = (req as AuthReq).auth;
  const type = req.params.type as RecycleType;
  const id = parseId(req.params.id);
  const table = tableFor(type);

  await db.delete(table as typeof jobsTable).where(eq((table as typeof jobsTable).id, id));

  await logAudit({
    userId: auth.userId,
    userRole: auth.role,
    action: `Permanently deleted ${type}`,
    entityType: type,
    entityId: id,
    description: `Permanently deleted ${type} #${id}`,
    ipAddress: req.ip,
  });

  res.json({ success: true });
});

export default router;
