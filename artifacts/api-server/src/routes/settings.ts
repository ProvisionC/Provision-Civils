import { Router, type IRouter, type Request } from "express";
import { db, companySettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole, type AuthPayload } from "../middlewares/auth.js";
import { logAudit } from "./audit.js";

const router: IRouter = Router();
type AuthReq = Request & { auth: AuthPayload };

const SETTINGS_ID = 1;

router.get("/settings/company", requireAuth, async (req, res): Promise<void> => {
  let [settings] = await db.select().from(companySettingsTable).where(eq(companySettingsTable.id, SETTINGS_ID));
  if (!settings) {
    [settings] = await db.insert(companySettingsTable).values({ id: SETTINGS_ID, companyName: "Provision Civils" }).returning();
  }
  res.json(settings);
});

router.put("/settings/company", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const auth = (req as AuthReq).auth;
  const body = req.body as Record<string, unknown>;

  const [updated] = await db
    .insert(companySettingsTable)
    .values({ id: SETTINGS_ID, companyName: "Provision Civils", ...body, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: companySettingsTable.id,
      set: { ...body, updatedAt: new Date() },
    })
    .returning();

  await logAudit({
    userId: auth.userId,
    userRole: auth.role,
    action: "Updated Company Settings",
    entityType: "company_settings",
    entityId: SETTINGS_ID,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json(updated);
});

export default router;
