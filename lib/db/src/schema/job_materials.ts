import { pgTable, text, serial, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jobMaterialsTable = pgTable("job_materials", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  name: text("name").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("0"),
  unit: text("unit").notNull().default("units"),
  cost: numeric("cost", { precision: 10, scale: 2 }),
  checked: boolean("checked").notNull().default(false),
  notes: text("notes"),
  isCustom: boolean("is_custom").notNull().default(false),
});

export const insertJobMaterialSchema = createInsertSchema(jobMaterialsTable).omit({ id: true });
export type InsertJobMaterial = z.infer<typeof insertJobMaterialSchema>;
export type JobMaterial = typeof jobMaterialsTable.$inferSelect;
