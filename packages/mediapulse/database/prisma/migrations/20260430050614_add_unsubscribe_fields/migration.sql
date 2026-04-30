-- AlterTable
ALTER TABLE "user_ticker" ADD COLUMN     "unsubscribe_method" TEXT,
ADD COLUMN     "unsubscribed_at" TIMESTAMP(3);
