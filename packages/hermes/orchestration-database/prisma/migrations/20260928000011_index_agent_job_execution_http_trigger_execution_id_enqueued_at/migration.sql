CREATE INDEX CONCURRENTLY IF NOT EXISTS "agent_job_execution_http_trigger_execution_id_enqueued_at_idx" ON "agent_job_execution"("http_trigger_execution_id", "enqueued_at");
