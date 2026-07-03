import { pgTable, serial, text, jsonb, timestamp, numeric } from "drizzle-orm/pg-core";

export const companySettingsTable = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull().default("Provision Civils"),
  logoBase64: text("logo_base64"),
  vatNumber: text("vat_number"),
  registrationNumber: text("registration_number"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  bankingDetails: jsonb("banking_details"),
  defaultLabourRates: jsonb("default_labour_rates"),
  payrollPeriod: text("payroll_period").default("weekly"),
  notificationTimes: jsonb("notification_times"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
