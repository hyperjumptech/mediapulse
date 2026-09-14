-- Collection dedup moves from `url` to `canonical_url` in `postDataCollectionExistingUrls`, so the
-- index that serves it has to move with it. `canonicalizeUrl` now folds the scheme, a `www.` host
-- and the `amp`, `source` and `page=all` parameters, which `url` preserves as collected.
--
-- Non-unique, for the same reasons as the index it replaces. `data_source` carries `ticker_id`, so
-- one article collected for two tickers is two legitimate rows, and `newsletter_citation` cascades
-- on delete, so collapsing existing duplicates would delete citations from newsletters that have
-- already shipped.
CREATE INDEX "data_source_ticker_id_canonical_url_idx" ON "data_source"("ticker_id", "canonical_url");

DROP INDEX IF EXISTS "data_source_ticker_id_url_idx";
