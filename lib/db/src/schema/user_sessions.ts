import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const userSessionsTable = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  isOnline: boolean("is_online").notNull().default(false),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  deviceInfo: text("device_info"),
  appVersion: text("app_version"),
  platform: text("platform"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
