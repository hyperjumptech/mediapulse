-- CreateEnum
CREATE TYPE "Day1DispatchKind" AS ENUM ('bootstrap', 'latest_issue', 'none');

-- CreateEnum
CREATE TYPE "Day1DispatchStatus" AS ENUM ('dispatching', 'fired', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "day1_newsletter_dispatch" (
    "id" TEXT NOT NULL,
    "user_ticker_id" TEXT NOT NULL,
    "ticker_id" TEXT NOT NULL,
    "language" "Language" NOT NULL,
    "kind" "Day1DispatchKind" NOT NULL,
    "status" "Day1DispatchStatus" NOT NULL,
    "reason" TEXT,
    "hermes_execution_id" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "day1_newsletter_dispatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "day1_newsletter_dispatch_ticker_id_kind_created_at_idx" ON "day1_newsletter_dispatch"("ticker_id", "kind", "created_at");

-- CreateIndex
CREATE INDEX "day1_newsletter_dispatch_user_ticker_id_idx" ON "day1_newsletter_dispatch"("user_ticker_id");

-- AddForeignKey
ALTER TABLE "day1_newsletter_dispatch" ADD CONSTRAINT "day1_newsletter_dispatch_user_ticker_id_fkey" FOREIGN KEY ("user_ticker_id") REFERENCES "user_ticker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "day1_newsletter_dispatch" ADD CONSTRAINT "day1_newsletter_dispatch_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
