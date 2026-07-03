import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jobsTable } from "./jobs";

export const NOTIFICATION_TYPES = [
  // Supervisor notifications
  "job_assigned", "job_updated", "report_reminder", "photos_not_uploaded",
  "completion_outstanding", "wayleave_outstanding", "new_message",
  // Admin notifications
  "daily_report_submitted", "photos_uploaded", "labour_submitted",
  "expense_added", "job_completed", "invoice_ready", "payroll_ready",
  "employee_paid", "new_client",
  // Project notifications
  "job_overdue", "job_due_today", "job_completed_project", "progress_milestone",
  "material_low", "po_uploaded", "variation_added",
  // System notifications
  "app_update", "server_offline", "backup_completed",
  // Legacy (keep for backwards compat)
  "invoice_created",
] as const;

export type NotificationType = typeof NOTIFICATION_TYPES[number];

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(),
  read: boolean("read").notNull().default(false),
  jobId: integer("job_id").references(() => jobsTable.id, { onDelete: "set null" }),
  referenceType: text("reference_type"),
  referenceId: integer("reference_id"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
