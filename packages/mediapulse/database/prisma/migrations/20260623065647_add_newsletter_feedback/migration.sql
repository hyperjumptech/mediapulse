-- CreateEnum
CREATE TYPE "FeedbackSentiment" AS ENUM ('positive', 'negative', 'neutral', 'mixed');

-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('praise', 'complaint', 'feature_request', 'bug', 'question', 'other');

-- DropIndex
DROP INDEX "data_source_global_canonical_url_key";

-- DropIndex
DROP INDEX "data_source_ticker_canonical_url_key";

-- CreateTable
CREATE TABLE "newsletter_feedback" (
    "id" TEXT NOT NULL,
    "sender_email" TEXT NOT NULL,
    "subject" TEXT,
    "raw_body" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "graph_message_id" TEXT NOT NULL,
    "in_reply_to" TEXT,
    "sentiment" "FeedbackSentiment",
    "category" "FeedbackCategory",
    "classifier_model" TEXT,
    "classified_at" TIMESTAMP(3),
    "user_id" TEXT,
    "user_ticker_id" TEXT,
    "newsletter_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_feedback_graph_message_id_key" ON "newsletter_feedback"("graph_message_id");

-- CreateIndex
CREATE INDEX "newsletter_feedback_sender_email_idx" ON "newsletter_feedback"("sender_email");

-- CreateIndex
CREATE INDEX "newsletter_feedback_newsletter_id_idx" ON "newsletter_feedback"("newsletter_id");

-- AddForeignKey
ALTER TABLE "newsletter_feedback" ADD CONSTRAINT "newsletter_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "mediapulse_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_feedback" ADD CONSTRAINT "newsletter_feedback_user_ticker_id_fkey" FOREIGN KEY ("user_ticker_id") REFERENCES "user_ticker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_feedback" ADD CONSTRAINT "newsletter_feedback_newsletter_id_fkey" FOREIGN KEY ("newsletter_id") REFERENCES "newsletter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
