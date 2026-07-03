import { pgTable, text, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const pushTokensTable = pgTable("push_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  platform: text("platform", { enum: ["ios", "android"] }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.userId)]);

export type PushToken = typeof pushTokensTable.$inferSelect;
