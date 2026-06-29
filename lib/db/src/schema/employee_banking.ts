import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const employeeBankingTable = pgTable("employee_banking", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  bankName: text("bank_name").notNull(),
  accountHolder: text("account_holder").notNull(),
  accountNumber: text("account_number").notNull(),
  branchCode: text("branch_code").notNull(),
  accountType: text("account_type", { enum: ["cheque", "savings", "transmission"] }).notNull().default("cheque"),
});

export const insertEmployeeBankingSchema = createInsertSchema(employeeBankingTable).omit({ id: true });
export type InsertEmployeeBanking = z.infer<typeof insertEmployeeBankingSchema>;
export type EmployeeBanking = typeof employeeBankingTable.$inferSelect;
