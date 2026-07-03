import { pgTable, text, serial, integer, timestamp, numeric, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { conversationsTable } from "./conversations";
import { usersTable } from "./users";

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").references(() => usersTable.id, { onDelete: "set null" }),
  type: text("type", { enum: ["text", "image", "document", "location", "voice", "video"] }).notNull().default("text"),
  content: text("content").notNull(),
  fileName: text("file_name"),
  fileMime: text("file_mime"),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  replyToId: integer("reply_to_id").references((): any => messagesTable.id, { onDelete: "set null" }),
  pinnedAt: timestamp("pinned_at", { withTimezone: true }),
  pinnedBy: integer("pinned_by").references(() => usersTable.id, { onDelete: "set null" }),
  editedAt: timestamp("edited_at", { withTimezone: true }),
  mentions: jsonb("mentions").$type<number[]>().default([]),
  voiceDuration: integer("voice_duration"),
  reactions: jsonb("reactions").$type<Record<string, number[]>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true, deletedAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;
