CREATE INDEX CONCURRENTLY IF NOT EXISTS "schedule_execution_schedule_id_execution_time_idx" ON "schedule_execution"("schedule_id", "execution_time" DESC);
