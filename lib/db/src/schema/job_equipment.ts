import { pgTable, text, serial, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jobsTable } from "./jobs";

export const jobEquipmentTable = pgTable("job_equipment", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
  cost: numeric("cost", { precision: 10, scale: 2 }),
});

export const insertJobEquipmentSchema = createInsertSchema(jobEquipmentTable).omit({ id: true });
export type InsertJobEquipment = z.infer<typeof insertJobEquipmentSchema>;
export type JobEquipment = typeof jobEquipmentTable.$inferSelect;
