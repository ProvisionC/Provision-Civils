import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { conversationsTable } from "./conversations";
import { usersTable } from "./users";

export const conversationMembersTable = pgTable("conversation_members", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.conversationId, t.userId)]);

export type ConversationMember = typeof conversationMembersTable.$inferSelect;
