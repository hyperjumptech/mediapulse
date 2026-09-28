CREATE INDEX CONCURRENTLY IF NOT EXISTS "agent_job_execution_manual_execution_id_enqueued_at_idx" ON "agent_job_execution"("manual_execution_id", "enqueued_at");
