import { pgTable, serial, integer, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";

export const crashReportsTable = pgTable("crash_reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  userName: text("user_name"),
  appVersion: text("app_version"),
  platform: text("platform"),
  deviceInfo: jsonb("device_info"),
  errorMessage: text("error_message").notNull(),
  stackTrace: text("stack_trace"),
  extraContext: jsonb("extra_context"),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
