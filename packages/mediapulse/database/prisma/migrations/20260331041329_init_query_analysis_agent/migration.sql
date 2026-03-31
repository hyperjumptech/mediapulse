-- AlterTable
ALTER TABLE "search_query" ADD COLUMN     "intent" TEXT,
ADD COLUMN     "rank" INTEGER,
ADD COLUMN     "set_id" TEXT,
ADD COLUMN     "source" TEXT;

-- CreateTable
CREATE TABLE "search_query_set" (
    "id" TEXT NOT NULL,
    "ticker_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "strategy_snapshot" JSONB NOT NULL,
    "generation_source" TEXT NOT NULL,
    "agent_job_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_query_set_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "search_query_set" ADD CONSTRAINT "search_query_set_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_query" ADD CONSTRAINT "search_query_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "search_query_set"("id") ON DELETE SET NULL ON UPDATE CASCADE;
