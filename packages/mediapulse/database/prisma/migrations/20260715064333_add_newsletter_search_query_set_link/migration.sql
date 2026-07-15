-- AlterTable
ALTER TABLE "newsletter" ADD COLUMN     "search_query_set_id" TEXT;

-- CreateIndex
CREATE INDEX "newsletter_search_query_set_id_idx" ON "newsletter"("search_query_set_id");

-- AddForeignKey
ALTER TABLE "newsletter" ADD CONSTRAINT "newsletter_search_query_set_id_fkey" FOREIGN KEY ("search_query_set_id") REFERENCES "search_query_set"("id") ON DELETE SET NULL ON UPDATE CASCADE;
