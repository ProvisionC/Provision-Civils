import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { messagesTable } from "./messages";
import { usersTable } from "./users";

export const messageReadsTable = pgTable("message_reads", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull().references(() => messagesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.messageId, t.userId)]);

export type MessageRead = typeof messageReadsTable.$inferSelect;
