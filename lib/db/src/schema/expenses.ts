import { pgTable, text, serial, integer, numeric, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jobsTable } from "./jobs";

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
  createdById: integer("created_by_id").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  category: text("category", {
    enum: ["fuel", "diesel", "accommodation", "labour", "plant_hire", "tools", "concrete", "materials", "subcontractors", "other"],
  }).notNull().default("other"),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  receiptPhotoUri: text("receipt_photo_uri"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({ id: true, createdAt: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;
