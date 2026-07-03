import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { jobsTable } from "./jobs";
import { teamsTable } from "./teams";

export const conversationsTable = pgTable("conversations", {
  id: serial("id").primaryKey(),
  type: text("type", { enum: ["direct", "job_chat", "team_chat"] }).notNull(),
  name: text("name"),
  jobId: integer("job_id").references(() => jobsTable.id, { onDelete: "cascade" }),
  teamId: integer("team_id").references(() => teamsTable.id, { onDelete: "cascade" }),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertConversationSchema = createInsertSchema(conversationsTable).omit({ id: true, createdAt: true });
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversationsTable.$inferSelect;
