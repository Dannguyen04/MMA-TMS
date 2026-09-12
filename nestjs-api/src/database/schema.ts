import {
  pgTable,
  uuid,
  text,
  integer,
  pgEnum,
  timestamp,
} from 'drizzle-orm/pg-core';

export const jobStatusEnum = pgEnum('job_status', [
  'PENDING',
  'PROCESSING',
  'DONE',
  'FAILED',
]);

export const analysisJobs = pgTable('analysis_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().default('anonymous'),
  videoUrl: text('video_url').notNull(),
  status: jobStatusEnum('status').notNull().default('PENDING'),
  resultUrl: text('result_url'),
  score: integer('score'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type AnalysisJob = typeof analysisJobs.$inferSelect;
export type InsertAnalysisJob = typeof analysisJobs.$inferInsert;
