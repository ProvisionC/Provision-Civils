import { pgTable, integer, primaryKey } from "drizzle-orm/pg-core";
import { jobsTable } from "./jobs";

export const jobWorkersTable = pgTable("job_workers", {
  jobId: integer("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
  workerId: integer("worker_id").notNull(),
}, (t) => [primaryKey({ columns: [t.jobId, t.workerId] })]);

export type JobWorker = typeof jobWorkersTable.$inferSelect;
