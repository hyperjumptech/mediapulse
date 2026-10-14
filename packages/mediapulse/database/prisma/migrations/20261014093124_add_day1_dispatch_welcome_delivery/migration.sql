-- AlterTable
ALTER TABLE "day1_newsletter_dispatch" ADD COLUMN     "welcome_claimed_at" TIMESTAMP(3),
ADD COLUMN     "welcome_resend_email_id" TEXT,
ADD COLUMN     "welcome_sent_at" TIMESTAMP(3);
