-- CreateEnum
CREATE TYPE "ContentGenerationRunOutcome" AS ENUM ('success', 'skipped', 'failed');

-- CreateEnum
CREATE TYPE "ContentGenerationRunStage" AS ENUM ('precheck', 'llm', 'validate', 'persist');

-- CreateTable
CREATE TABLE "content_generation_run" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "agent_version" TEXT NOT NULL,
    "ticker_id" TEXT NOT NULL,
    "outcome" "ContentGenerationRunOutcome" NOT NULL,
    "stage" "ContentGenerationRunStage",
    "error_code" TEXT,
    "error_category" TEXT,
    "message" TEXT,
    "duration_ms" INTEGER,
    "pipeline_run_id" TEXT,
    "newsletter_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_generation_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_generation_run_ticker_id_created_at_idx" ON "content_generation_run"("ticker_id", "created_at");

-- CreateIndex
CREATE INDEX "content_generation_run_outcome_created_at_idx" ON "content_generation_run"("outcome", "created_at");

-- AddForeignKey
ALTER TABLE "content_generation_run" ADD CONSTRAINT "content_generation_run_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
