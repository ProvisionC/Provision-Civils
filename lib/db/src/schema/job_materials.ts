import { pgTable, text, serial, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jobMaterialsTable = pgTable("job_materials", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  name: text("name").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").notNull(),
  cost: numeric("cost", { precision: 10, scale: 2 }),
});

export const insertJobMaterialSchema = createInsertSchema(jobMaterialsTable).omit({ id: true });
export type InsertJobMaterial = z.infer<typeof insertJobMaterialSchema>;
export type JobMaterial = typeof jobMaterialsTable.$inferSelect;
