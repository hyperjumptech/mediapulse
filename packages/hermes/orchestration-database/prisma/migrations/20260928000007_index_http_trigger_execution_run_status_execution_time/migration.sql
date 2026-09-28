CREATE INDEX CONCURRENTLY IF NOT EXISTS "http_trigger_execution_run_status_execution_time_idx" ON "http_trigger_execution"("run_status", "execution_time" DESC);
