-- CreateTable
CREATE TABLE "newsletter_section" (
    "id" TEXT NOT NULL,
    "newsletter_id" TEXT NOT NULL,
    "section_key" TEXT NOT NULL,
    "heading" TEXT NOT NULL,
    "summary" TEXT,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newsletter_section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_section_item" (
    "id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "url" TEXT,
    "data_source_id" TEXT,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newsletter_section_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "newsletter_section_newsletter_id_position_idx" ON "newsletter_section"("newsletter_id", "position");

-- CreateIndex
CREATE INDEX "newsletter_section_item_section_id_position_idx" ON "newsletter_section_item"("section_id", "position");

-- CreateIndex
CREATE INDEX "newsletter_section_item_data_source_id_idx" ON "newsletter_section_item"("data_source_id");

-- AddForeignKey
ALTER TABLE "newsletter_section" ADD CONSTRAINT "newsletter_section_newsletter_id_fkey" FOREIGN KEY ("newsletter_id") REFERENCES "newsletter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_section_item" ADD CONSTRAINT "newsletter_section_item_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "newsletter_section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_section_item" ADD CONSTRAINT "newsletter_section_item_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_source"("id") ON DELETE SET NULL ON UPDATE CASCADE;
