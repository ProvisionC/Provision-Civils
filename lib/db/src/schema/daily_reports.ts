import { pgTable, text, serial, integer, numeric, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jobsTable } from "./jobs";

export const dailyReportsTable = pgTable("daily_reports", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  workCompleted: text("work_completed"),
  problemsEncountered: text("problems_encountered"),
  tomorrowWork: text("tomorrow_work"),
  labourOnSite: text("labour_on_site"),
  gpsLat: numeric("gps_lat", { precision: 10, scale: 7 }),
  gpsLng: numeric("gps_lng", { precision: 10, scale: 7 }),
  signatureUri: text("signature_uri"),
  notes: text("notes"),
  progressNotes: text("progress_notes"),
  photoUris: text("photo_uris").array().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDailyReportSchema = createInsertSchema(dailyReportsTable).omit({ id: true, createdAt: true });
export type InsertDailyReport = z.infer<typeof insertDailyReportSchema>;
export type DailyReport = typeof dailyReportsTable.$inferSelect;
