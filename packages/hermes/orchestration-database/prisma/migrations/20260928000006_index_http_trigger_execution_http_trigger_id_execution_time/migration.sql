CREATE INDEX CONCURRENTLY IF NOT EXISTS "http_trigger_execution_http_trigger_id_execution_time_idx" ON "http_trigger_execution"("http_trigger_id", "execution_time" DESC);
