import { pgTable, text, serial, timestamp, numeric, integer, date, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jobsTable = pgTable("jobs", {
  id: serial("id").primaryKey(),
  jobNumber: text("job_number").notNull().unique(),
  clientId: integer("client_id"),
  clientName: text("client_name").notNull(),
  clientPhone: text("client_phone"),
  clientEmail: text("client_email"),
  projectName: text("project_name"),
  projectNumber: text("project_number"),
  projectManagerId: integer("project_manager_id"),
  poNumber: text("po_number"),
  clientOrderNumber: text("client_order_number"),
  contractValue: numeric("contract_value", { precision: 14, scale: 2 }),
  siteAddress: text("site_address"),
  gpsLat: numeric("gps_lat", { precision: 10, scale: 7 }),
  gpsLng: numeric("gps_lng", { precision: 10, scale: 7 }),
  description: text("description"),
  notes: text("notes"),
  labourHours: numeric("labour_hours", { precision: 8, scale: 2 }),
  status: text("status", {
    enum: ["pending", "in_progress", "active", "waiting_for_wayleave", "waiting_for_materials", "completed", "cancelled"],
  }).notNull().default("active"),
  supervisorId: integer("supervisor_id"),
  startDate: date("start_date", { mode: "string" }),
  dueDate: date("due_date", { mode: "string" }),
  wayleaveRequired: boolean("wayleave_required").notNull().default(false),
  wayleaveDocument: text("wayleave_document"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({ id: true, jobNumber: true, createdAt: true, updatedAt: true });
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;
