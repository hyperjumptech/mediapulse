CREATE INDEX CONCURRENTLY IF NOT EXISTS "manual_pipeline_execution_pipeline_id_execution_time_idx" ON "manual_pipeline_execution"("pipeline_id", "execution_time" DESC);
