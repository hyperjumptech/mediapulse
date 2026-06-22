-- CreateEnum
CREATE TYPE "Language" AS ENUM ('en', 'id');

-- DropIndex
DROP INDEX "user_ticker_user_id_ticker_id_key";

-- AlterTable
ALTER TABLE "user_ticker" ADD COLUMN     "language" "Language" NOT NULL DEFAULT 'en';

-- CreateIndex
CREATE UNIQUE INDEX "user_ticker_user_id_ticker_id_language_key" ON "user_ticker"("user_id", "ticker_id", "language");
