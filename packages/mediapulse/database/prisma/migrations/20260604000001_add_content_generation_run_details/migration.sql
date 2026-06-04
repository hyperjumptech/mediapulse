-- Add observability details snapshot column to content_generation_run.
ALTER TABLE "content_generation_run" ADD COLUMN "details" JSONB;
