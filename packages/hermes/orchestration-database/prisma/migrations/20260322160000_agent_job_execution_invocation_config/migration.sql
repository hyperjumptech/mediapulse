-- Persist resolved step config alongside invocation input for dashboard debugging.
ALTER TABLE "agent_job_execution" ADD COLUMN "invocation_config" JSONB;
