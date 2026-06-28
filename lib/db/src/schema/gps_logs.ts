import { pgTable, serial, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gpsLogsTable = pgTable("gps_logs", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  userId: integer("user_id").notNull(),
  arrivalLat: numeric("arrival_lat", { precision: 10, scale: 7 }).notNull(),
  arrivalLng: numeric("arrival_lng", { precision: 10, scale: 7 }).notNull(),
  arrivalTime: timestamp("arrival_time", { withTimezone: true }).notNull(),
  departureLat: numeric("departure_lat", { precision: 10, scale: 7 }),
  departureLng: numeric("departure_lng", { precision: 10, scale: 7 }),
  departureTime: timestamp("departure_time", { withTimezone: true }),
});

export const insertGpsLogSchema = createInsertSchema(gpsLogsTable).omit({ id: true });
export type InsertGpsLog = z.infer<typeof insertGpsLogSchema>;
export type GpsLog = typeof gpsLogsTable.$inferSelect;
