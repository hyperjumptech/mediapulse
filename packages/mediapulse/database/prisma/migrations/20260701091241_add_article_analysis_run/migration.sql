-- CreateTable
CREATE TABLE "article_analysis_run" (
    "id" TEXT NOT NULL,
    "ticker_id" TEXT,
    "schedule_execution_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "status" "DataCollectionRunStatus" NOT NULL,
    "model" TEXT,
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "completion_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "scored" INTEGER NOT NULL DEFAULT 0,
    "rejected" INTEGER NOT NULL DEFAULT 0,
    "backlog" INTEGER NOT NULL DEFAULT 0,
    "stop_reason" TEXT,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_analysis_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "article_analysis_run_ticker_id_started_at_idx" ON "article_analysis_run"("ticker_id", "started_at");

-- CreateIndex
CREATE INDEX "article_analysis_run_schedule_execution_id_idx" ON "article_analysis_run"("schedule_execution_id");

-- AddForeignKey
ALTER TABLE "article_analysis_run" ADD CONSTRAINT "article_analysis_run_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
