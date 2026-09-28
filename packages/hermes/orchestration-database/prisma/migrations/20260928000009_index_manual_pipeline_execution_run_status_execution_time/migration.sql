CREATE INDEX CONCURRENTLY IF NOT EXISTS "manual_pipeline_execution_run_status_execution_time_idx" ON "manual_pipeline_execution"("run_status", "execution_time" DESC);
