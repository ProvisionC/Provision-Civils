import { pgTable, integer, primaryKey } from "drizzle-orm/pg-core";

export const jobWorkersTable = pgTable("job_workers", {
  jobId: integer("job_id").notNull(),
  workerId: integer("worker_id").notNull(),
}, (t) => [primaryKey({ columns: [t.jobId, t.workerId] })]);

export type JobWorker = typeof jobWorkersTable.$inferSelect;
