import { pgTable, serial, integer, text, timestamp, bigint } from "drizzle-orm/pg-core";

export const backupsTable = pgTable("backups", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  filePath: text("file_path").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  restoredAt: timestamp("restored_at", { withTimezone: true }),
  restoredBy: integer("restored_by"),
});
