import { pgTable, text, serial, timestamp, integer, numeric, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "project_manager", "supervisor", "worker"] }).notNull().default("worker"),
  phone: text("phone"),
  employeeNumber: text("employee_number").unique(),
  clockNumber: text("clock_number").unique(),
  idNumber: text("id_number"),
  dateOfBirth: date("date_of_birth", { mode: "string" }),
  homeAddress: text("home_address"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactNumber: text("emergency_contact_number"),
  jobTitle: text("job_title"),
  department: text("department"),
  supervisorId: integer("supervisor_id"),
  employmentStartDate: date("employment_start_date", { mode: "string" }),
  employmentStatus: text("employment_status", {
    enum: ["active", "suspended", "resigned", "dismissed"],
  }).notNull().default("active"),
  payrollType: text("payroll_type", { enum: ["hourly", "piece_work"] }),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }),
  meterRate: numeric("meter_rate", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
