-- CreateTable
CREATE TABLE "query_analysis_run" (
    "id" TEXT NOT NULL,
    "ticker_id" TEXT NOT NULL,
    "execution_id" TEXT,
    "queries" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "query_analysis_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "query_analysis_run_ticker_id_created_at_idx" ON "query_analysis_run"("ticker_id", "created_at");

-- CreateIndex
CREATE INDEX "query_analysis_run_execution_id_idx" ON "query_analysis_run"("execution_id");

-- AddForeignKey
ALTER TABLE "query_analysis_run" ADD CONSTRAINT "query_analysis_run_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
