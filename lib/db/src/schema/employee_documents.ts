import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const employeeDocumentsTable = pgTable("employee_documents", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  documentType: text("document_type", {
    enum: ["id_copy", "employment_contract", "medical_certificate", "warning_letter", "training_certificate", "drivers_licence", "other"],
  }).notNull(),
  name: text("name").notNull(),
  uri: text("uri").notNull(),
  uploadedById: integer("uploaded_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEmployeeDocumentSchema = createInsertSchema(employeeDocumentsTable).omit({ id: true, createdAt: true });
export type InsertEmployeeDocument = z.infer<typeof insertEmployeeDocumentSchema>;
export type EmployeeDocument = typeof employeeDocumentsTable.$inferSelect;
