-- CreateTable
CREATE TABLE "entity_evidence" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "data_source_id" TEXT NOT NULL,
    "ticker_id" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_relation_evidence" (
    "id" TEXT NOT NULL,
    "entity_relation_id" TEXT NOT NULL,
    "data_source_id" TEXT NOT NULL,
    "ticker_id" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "evidence_span" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_relation_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "entity_evidence_ticker_id_data_source_id_idx" ON "entity_evidence"("ticker_id", "data_source_id");

-- CreateIndex
CREATE INDEX "entity_evidence_data_source_id_idx" ON "entity_evidence"("data_source_id");

-- CreateIndex
CREATE UNIQUE INDEX "entity_evidence_entity_id_data_source_id_ticker_id_key" ON "entity_evidence"("entity_id", "data_source_id", "ticker_id");

-- CreateIndex
CREATE INDEX "entity_relation_evidence_ticker_id_data_source_id_idx" ON "entity_relation_evidence"("ticker_id", "data_source_id");

-- CreateIndex
CREATE INDEX "entity_relation_evidence_data_source_id_idx" ON "entity_relation_evidence"("data_source_id");

-- CreateIndex
CREATE UNIQUE INDEX "entity_relation_evidence_entity_relation_id_data_source_id__key" ON "entity_relation_evidence"("entity_relation_id", "data_source_id", "ticker_id");

-- AddForeignKey
ALTER TABLE "entity_evidence" ADD CONSTRAINT "entity_evidence_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_evidence" ADD CONSTRAINT "entity_evidence_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_evidence" ADD CONSTRAINT "entity_evidence_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_relation_evidence" ADD CONSTRAINT "entity_relation_evidence_entity_relation_id_fkey" FOREIGN KEY ("entity_relation_id") REFERENCES "entity_relation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_relation_evidence" ADD CONSTRAINT "entity_relation_evidence_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_relation_evidence" ADD CONSTRAINT "entity_relation_evidence_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
