import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jobPhotosTable = pgTable("job_photos", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  uri: text("uri").notNull(),
  caption: text("caption"),
  uploadedById: integer("uploaded_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertJobPhotoSchema = createInsertSchema(jobPhotosTable).omit({ id: true, createdAt: true });
export type InsertJobPhoto = z.infer<typeof insertJobPhotoSchema>;
export type JobPhoto = typeof jobPhotosTable.$inferSelect;
