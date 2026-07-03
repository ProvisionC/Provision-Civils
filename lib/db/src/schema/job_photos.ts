import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jobsTable } from "./jobs";

export const PHOTO_CATEGORIES = ["before", "during", "after", "other"] as const;
export type PhotoCategory = typeof PHOTO_CATEGORIES[number];

export const jobPhotosTable = pgTable("job_photos", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
  uri: text("uri").notNull(),
  caption: text("caption"),
  category: text("category").notNull().default("other"),
  uploadedById: integer("uploaded_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const insertJobPhotoSchema = createInsertSchema(jobPhotosTable).omit({ id: true, createdAt: true });
export type InsertJobPhoto = z.infer<typeof insertJobPhotoSchema>;
export type JobPhoto = typeof jobPhotosTable.$inferSelect;
