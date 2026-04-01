-- CreateEnum
CREATE TYPE "DeliveryRunOutcome" AS ENUM ('success', 'skipped', 'failed', 'partial_success');

-- CreateEnum
CREATE TYPE "DeliveryRunStage" AS ENUM ('fetch', 'render', 'send', 'persist_delivery_record');

-- CreateTable
CREATE TABLE "newsletter_delivery_checkpoint" (
    "id" TEXT NOT NULL,
    "newsletter_id" TEXT NOT NULL,
    "user_ticker_id" TEXT NOT NULL,
    "delivered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resend_email_id" TEXT,

    CONSTRAINT "newsletter_delivery_checkpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_run" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "agent_version" TEXT NOT NULL,
    "ticker_id" TEXT NOT NULL,
    "newsletter_id" TEXT,
    "outcome" "DeliveryRunOutcome" NOT NULL,
    "stage" "DeliveryRunStage",
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER NOT NULL,
    "schedule_execution_id" TEXT,
    "pipeline_step_id" TEXT,
    "job_id" TEXT,
    "resend_message_ids" JSONB,
    "recipient_error_summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_recipient_outcome" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "user_ticker_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error_code" TEXT,
    "last_error_message" TEXT,
    "resend_email_id" TEXT,

    CONSTRAINT "delivery_recipient_outcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_delivery_checkpoint_newsletter_id_user_ticker_id_key" ON "newsletter_delivery_checkpoint"("newsletter_id", "user_ticker_id");

-- CreateIndex
CREATE INDEX "delivery_run_ticker_id_created_at_idx" ON "delivery_run"("ticker_id", "created_at");

-- CreateIndex
CREATE INDEX "delivery_run_outcome_created_at_idx" ON "delivery_run"("outcome", "created_at");

-- CreateIndex
CREATE INDEX "delivery_recipient_outcome_run_id_idx" ON "delivery_recipient_outcome"("run_id");

-- AddForeignKey
ALTER TABLE "newsletter_delivery_checkpoint" ADD CONSTRAINT "newsletter_delivery_checkpoint_newsletter_id_fkey" FOREIGN KEY ("newsletter_id") REFERENCES "newsletter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_delivery_checkpoint" ADD CONSTRAINT "newsletter_delivery_checkpoint_user_ticker_id_fkey" FOREIGN KEY ("user_ticker_id") REFERENCES "user_ticker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_run" ADD CONSTRAINT "delivery_run_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_run" ADD CONSTRAINT "delivery_run_newsletter_id_fkey" FOREIGN KEY ("newsletter_id") REFERENCES "newsletter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_recipient_outcome" ADD CONSTRAINT "delivery_recipient_outcome_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "delivery_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
