-- Adds the two intents that had no query aimed at them.
--
-- Over a 21-day window issuerPerformance and issuerNews shipped 150 newsletter items between them,
-- none found by a query targeting those sections: they filled only when a search for another intent
-- happened to return the issuer's own results or news.
--
-- Postgres appends enum values, so existing rows and the values already stored are untouched.
ALTER TYPE "SearchQueryIntent" ADD VALUE IF NOT EXISTS 'issuerPerformance';
ALTER TYPE "SearchQueryIntent" ADD VALUE IF NOT EXISTS 'issuerNews';
