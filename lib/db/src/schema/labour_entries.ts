import { pgTable, text, serial, integer, numeric, timestamp, date, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jobsTable } from "./jobs";
import { usersTable } from "./users";

export const labourEntriesTable = pgTable("labour_entries", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  date: date("date", { mode: "string" }).notNull(),
  workType: text("work_type", {
    enum: ["trenching", "backfilling", "cable_pulling", "reinstatement", "manhole_installation", "concrete", "other"],
  }).notNull(),
  payrollType: text("payroll_type", { enum: ["hourly", "piece_work"] }).notNull(),
  clockIn: text("clock_in"),
  clockOut: text("clock_out"),
  lunchBreakTaken: boolean("lunch_break_taken").notNull().default(false),
  breakMinutes: integer("break_minutes").notNull().default(0),
  hoursWorked: numeric("hours_worked", { precision: 6, scale: 2 }),
  startChainage: numeric("start_chainage", { precision: 10, scale: 2 }),
  endChainage: numeric("end_chainage", { precision: 10, scale: 2 }),
  metersCompleted: numeric("meters_completed", { precision: 10, scale: 2 }),
  rateUsed: numeric("rate_used", { precision: 10, scale: 2 }),
  amountPayable: numeric("amount_payable", { precision: 10, scale: 2 }),
  status: text("status", { enum: ["open", "complete"] }).notNull().default("open"),
  notes: text("notes"),
  createdById: integer("created_by_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLabourEntrySchema = createInsertSchema(labourEntriesTable).omit({ id: true, createdAt: true });
export type InsertLabourEntry = z.infer<typeof insertLabourEntrySchema>;
export type LabourEntry = typeof labourEntriesTable.$inferSelect;
