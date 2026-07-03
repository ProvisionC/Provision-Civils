import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { teamsTable } from "./teams";
import { usersTable } from "./users";

export const teamMembersTable = pgTable("team_members", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.teamId, t.userId)]);

export type TeamMember = typeof teamMembersTable.$inferSelect;
