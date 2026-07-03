import { pgTable, text, serial, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jobsTable } from "./jobs";

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
  invoiceNumber: text("invoice_number").notNull().unique(),
  labourCost: numeric("labour_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  materialsCost: numeric("materials_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  equipmentCost: numeric("equipment_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  vat: numeric("vat", { precision: 5, scale: 2 }).notNull().default("15"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
  status: text("status", { enum: ["draft", "sent", "paid", "overdue"] }).notNull().default("draft"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true, invoiceNumber: true, createdAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
