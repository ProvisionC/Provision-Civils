import { pgTable, text, serial, integer, date, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const leaveRecordsTable = pgTable("leave_records", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  leaveType: text("leave_type", {
    enum: ["annual", "sick", "family_responsibility", "unpaid"],
  }).notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  days: numeric("days", { precision: 4, scale: 1 }).notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  notes: text("notes"),
  approvedById: integer("approved_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLeaveRecordSchema = createInsertSchema(leaveRecordsTable).omit({ id: true, createdAt: true });
export type InsertLeaveRecord = z.infer<typeof insertLeaveRecordSchema>;
export type LeaveRecord = typeof leaveRecordsTable.$inferSelect;
