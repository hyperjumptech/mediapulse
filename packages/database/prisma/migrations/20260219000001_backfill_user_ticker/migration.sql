-- Optional backfill: subscribe the first user to all existing tickers so at least one subscriber exists per ticker until subscriptions are managed in UI.
INSERT INTO "user_ticker" ("id", "user_id", "ticker_id", "enabled", "created_at", "updated_at")
SELECT gen_random_uuid(), u.id, t.id, true, NOW(), NOW()
FROM "user" u
CROSS JOIN "ticker" t
WHERE u.id = (SELECT id FROM "user" ORDER BY created_at ASC LIMIT 1)
ON CONFLICT ("user_id", "ticker_id") DO NOTHING;
