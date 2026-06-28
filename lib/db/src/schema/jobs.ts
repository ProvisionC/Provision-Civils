import { pgTable, text, serial, timestamp, numeric, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jobsTable = pgTable("jobs", {
  id: serial("id").primaryKey(),
  jobNumber: text("job_number").notNull().unique(),
  clientName: text("client_name").notNull(),
  clientPhone: text("client_phone"),
  clientEmail: text("client_email"),
  siteAddress: text("site_address"),
  gpsLat: numeric("gps_lat", { precision: 10, scale: 7 }),
  gpsLng: numeric("gps_lng", { precision: 10, scale: 7 }),
  description: text("description"),
  notes: text("notes"),
  labourHours: numeric("labour_hours", { precision: 8, scale: 2 }),
  status: text("status", {
    enum: ["pending", "in_progress", "waiting_for_materials", "completed", "cancelled"],
  }).notNull().default("pending"),
  supervisorId: integer("supervisor_id"),
  dueDate: date("due_date", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({ id: true, jobNumber: true, createdAt: true, updatedAt: true });
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;
