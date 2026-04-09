-- CreateEnum
CREATE TYPE "SearchQuerySource" AS ENUM ('deterministic', 'llm');

-- CreateEnum
CREATE TYPE "SearchQueryIntent" AS ENUM ('breaking', 'kg_change', 'fundamental');

-- AlterTable
ALTER TABLE "search_query"
ADD COLUMN "intent" "SearchQueryIntent" NOT NULL DEFAULT 'breaking',
ADD COLUMN "rank" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "set_id" TEXT,
ADD COLUMN "source" "SearchQuerySource" NOT NULL DEFAULT 'deterministic';

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
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_query_set_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_query_set_ticker_id_is_active_idx" ON "search_query_set"("ticker_id", "is_active");

-- CreateIndex
CREATE INDEX "search_query_ticker_id_set_id_idx" ON "search_query"("ticker_id", "set_id");

-- CreateIndex
CREATE UNIQUE INDEX "search_query_set_id_text_key" ON "search_query"("set_id", "text");

-- AddForeignKey
ALTER TABLE "search_query" ADD CONSTRAINT "search_query_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "search_query_set"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_query_set" ADD CONSTRAINT "search_query_set_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
