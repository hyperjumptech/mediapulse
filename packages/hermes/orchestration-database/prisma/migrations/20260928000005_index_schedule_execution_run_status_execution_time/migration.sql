CREATE INDEX CONCURRENTLY IF NOT EXISTS "schedule_execution_run_status_execution_time_idx" ON "schedule_execution"("run_status", "execution_time" DESC);
