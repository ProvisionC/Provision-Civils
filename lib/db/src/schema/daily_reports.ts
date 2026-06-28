import { pgTable, text, serial, integer, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dailyReportsTable = pgTable("daily_reports", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  userId: integer("user_id").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  notes: text("notes"),
  progressNotes: text("progress_notes"),
  photoUris: text("photo_uris").array().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDailyReportSchema = createInsertSchema(dailyReportsTable).omit({ id: true, createdAt: true });
export type InsertDailyReport = z.infer<typeof insertDailyReportSchema>;
export type DailyReport = typeof dailyReportsTable.$inferSelect;
