-- CreateEnum
CREATE TYPE "query_source" AS ENUM ('DETERMINISTIC', 'LLM');

-- CreateEnum
CREATE TYPE "query_intent" AS ENUM ('BREAKING', 'KG_CHANGE', 'FUNDAMENTAL');

-- CreateTable
CREATE TABLE "search_query_set" (
    "id" TEXT NOT NULL,
    "ticker_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "strategy_snapshot" JSONB NOT NULL,
    "generation_source" TEXT NOT NULL,
    "agent_job_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_query_set_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_query_set_ticker_id_is_active_idx" ON "search_query_set"("ticker_id", "is_active");

-- AddForeignKey
ALTER TABLE "search_query_set" ADD CONSTRAINT "search_query_set_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "search_query" ADD COLUMN "set_id" TEXT,
                            ADD COLUMN "source" "query_source",
                            ADD COLUMN "intent" "query_intent",
                            ADD COLUMN "rank" INTEGER;

-- AddForeignKey
ALTER TABLE "search_query" ADD CONSTRAINT "search_query_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "search_query_set"("id") ON DELETE SET NULL ON UPDATE CASCADE;
