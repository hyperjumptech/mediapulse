CREATE INDEX CONCURRENTLY IF NOT EXISTS "schedule_enabled_next_run_at_idx" ON "schedule"("enabled", "next_run_at");
