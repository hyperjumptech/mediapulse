-- Query provenance is no longer distinguished by the self-driving query-analysis
-- agent (intent carries it), and the reactive merge engine that read it was
-- removed in the 3.0.0 rewrite. Drop the column and its enum type.
ALTER TABLE "search_query" DROP COLUMN "source";

DROP TYPE "SearchQuerySource";
