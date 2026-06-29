-- CreateTable
CREATE TABLE "newsletter_translation" (
    "id" TEXT NOT NULL,
    "newsletter_id" TEXT NOT NULL,
    "language" "Language" NOT NULL,
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "total_tokens" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_translation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_translation_newsletter_id_language_key" ON "newsletter_translation"("newsletter_id", "language");

-- AddForeignKey
ALTER TABLE "newsletter_translation" ADD CONSTRAINT "newsletter_translation_newsletter_id_fkey" FOREIGN KEY ("newsletter_id") REFERENCES "newsletter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
