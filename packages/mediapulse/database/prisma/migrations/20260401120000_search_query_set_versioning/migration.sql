-- Idempotent migration: safe when a prior local DB already applied an older query-set migration.

-- CreateEnum (ignore if exists)
DO $$ BEGIN
    CREATE TYPE "SearchQuerySource" AS ENUM ('deterministic', 'llm');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "SearchQueryIntent" AS ENUM ('breaking', 'kg_change', 'fundamental');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "search_query_set" (
    "id" TEXT NOT NULL,
    "ticker_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "strategy_snapshot" JSONB NOT NULL,
    "generation_source" TEXT NOT NULL,
    "agent_job_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_query_set_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "search_query_set_ticker_id_idx" ON "search_query_set"("ticker_id");

DROP INDEX IF EXISTS "search_query_set_one_active_per_ticker";
CREATE UNIQUE INDEX "search_query_set_one_active_per_ticker" ON "search_query_set" ("ticker_id") WHERE "is_active" = true;

DO $$ BEGIN
    ALTER TABLE "search_query_set" ADD CONSTRAINT "search_query_set_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "ticker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "search_query" ADD COLUMN IF NOT EXISTS "set_id" TEXT;

DO $$ BEGIN
    ALTER TABLE "search_query" ADD COLUMN "source" "SearchQuerySource" NOT NULL DEFAULT 'deterministic';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "search_query" ADD COLUMN "intent" "SearchQueryIntent" NOT NULL DEFAULT 'fundamental';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "search_query" ADD COLUMN "rank" INTEGER NOT NULL DEFAULT 0;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "search_query_set_id_idx" ON "search_query"("set_id");

DO $$ BEGIN
    ALTER TABLE "search_query" ADD CONSTRAINT "search_query_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "search_query_set"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
