-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TickerEntitySource" AS ENUM ('SEED', 'EXTRACTED', 'MANUAL');

-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('POSITIVE', 'NEGATIVE', 'NEUTRAL');

-- CreateTable
CREATE TABLE "data_source" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "ticker_id" TEXT NOT NULL,
    "search_query_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_source_expansion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "expansion_string" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT NOT NULL,

    CONSTRAINT "data_source_expansion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "ticker_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_type" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entity_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relation_type" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relation_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity" (
    "id" TEXT NOT NULL,
    "type_id" TEXT NOT NULL,
    "canonical_name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_alias" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalized_alias" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_alias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticker_entity" (
    "id" TEXT NOT NULL,
    "ticker_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "relevance_weight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "source" "TickerEntitySource" NOT NULL DEFAULT 'EXTRACTED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticker_entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_relation" (
    "id" TEXT NOT NULL,
    "from_entity_id" TEXT NOT NULL,
    "to_entity_id" TEXT NOT NULL,
    "relation_type_id" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_relation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_entity" (
    "id" TEXT NOT NULL,
    "data_source_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "mention_count" INTEGER NOT NULL DEFAULT 1,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "sentiment" "Sentiment",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_relevance" (
    "id" TEXT NOT NULL,
    "data_source_id" TEXT NOT NULL,
    "ticker_id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "score_breakdown" JSONB NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "scored_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_relevance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_query" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "ticker_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_query_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticker" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_ticker" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "ticker_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_ticker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "entity_type_name_key" ON "entity_type"("name");

-- CreateIndex
CREATE UNIQUE INDEX "relation_type_name_key" ON "relation_type"("name");

-- CreateIndex
CREATE INDEX "entity_alias_normalized_alias_idx" ON "entity_alias"("normalized_alias");

-- CreateIndex
CREATE UNIQUE INDEX "entity_alias_entity_id_normalized_alias_key" ON "entity_alias"("entity_id", "normalized_alias");

-- CreateIndex
CREATE UNIQUE INDEX "ticker_entity_ticker_id_entity_id_key" ON "ticker_entity"("ticker_id", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "entity_relation_from_entity_id_to_entity_id_relation_type_i_key" ON "entity_relation"("from_entity_id", "to_entity_id", "relation_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "article_entity_data_source_id_entity_id_key" ON "article_entity"("data_source_id", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "article_relevance_data_source_id_ticker_id_key" ON "article_relevance"("data_source_id", "ticker_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticker_symbol_key" ON "ticker"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "user_ticker_user_id_ticker_id_key" ON "user_ticker"("user_id", "ticker_id");

-- AddForeignKey
ALTER TABLE "data_source" ADD CONSTRAINT "data_source_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_source" ADD CONSTRAINT "data_source_search_query_id_fkey" FOREIGN KEY ("search_query_id") REFERENCES "search_query"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter" ADD CONSTRAINT "newsletter_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity" ADD CONSTRAINT "entity_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "entity_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_alias" ADD CONSTRAINT "entity_alias_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticker_entity" ADD CONSTRAINT "ticker_entity_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticker_entity" ADD CONSTRAINT "ticker_entity_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_relation" ADD CONSTRAINT "entity_relation_from_entity_id_fkey" FOREIGN KEY ("from_entity_id") REFERENCES "entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_relation" ADD CONSTRAINT "entity_relation_to_entity_id_fkey" FOREIGN KEY ("to_entity_id") REFERENCES "entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_relation" ADD CONSTRAINT "entity_relation_relation_type_id_fkey" FOREIGN KEY ("relation_type_id") REFERENCES "relation_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_entity" ADD CONSTRAINT "article_entity_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_entity" ADD CONSTRAINT "article_entity_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_relevance" ADD CONSTRAINT "article_relevance_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_relevance" ADD CONSTRAINT "article_relevance_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_query" ADD CONSTRAINT "search_query_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_ticker" ADD CONSTRAINT "user_ticker_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
