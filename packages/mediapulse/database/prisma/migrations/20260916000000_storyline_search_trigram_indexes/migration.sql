-- Storyline search reads `storyline.name` and `storyline_anchor.anchor` with a case-insensitive
-- `contains`, which a btree index cannot serve: every such query degrades to a sequential scan as
-- the knowledge base grows. Trigram GIN indexes are what make an unanchored substring match
-- indexable, so searching an anchor ("find the thread about the contract delay") stays cheap.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "storyline_name_trgm_idx"
  ON "storyline" USING gin ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "storyline_anchor_anchor_trgm_idx"
  ON "storyline_anchor" USING gin ("anchor" gin_trgm_ops);
