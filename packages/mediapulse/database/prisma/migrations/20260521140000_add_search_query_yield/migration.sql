-- CreateTable
CREATE TABLE "search_query_yield" (
    "id" TEXT NOT NULL,
    "search_query_id" TEXT NOT NULL,
    "run_date" DATE NOT NULL,
    "article_count" INTEGER NOT NULL,
    "novel_article_count" INTEGER NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_query_yield_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_query_yield_search_query_id_run_date_idx" ON "search_query_yield"("search_query_id", "run_date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "search_query_yield_search_query_id_run_date_key" ON "search_query_yield"("search_query_id", "run_date");

-- AddForeignKey
ALTER TABLE "search_query_yield" ADD CONSTRAINT "search_query_yield_search_query_id_fkey" FOREIGN KEY ("search_query_id") REFERENCES "search_query"("id") ON DELETE CASCADE ON UPDATE CASCADE;
