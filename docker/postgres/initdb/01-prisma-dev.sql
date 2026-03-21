-- Local dev cluster: one role (`POSTGRES_USER` / mediapulse) with full privileges.
-- The official postgres image already creates that user as SUPERUSER; we set attributes explicitly so
-- tooling (Prisma migrate dev, shadow DBs) and intent stay obvious.
--
-- Prisma "migrate dev" needs either CREATEDB (or SUPERUSER) or a pre-created shadow DB (see prisma.config.ts).
-- We also create shadow databases here so migrate dev does not need CREATE DATABASE on TCP. Runs only on
-- first cluster init (empty ./data).

ALTER ROLE mediapulse WITH SUPERUSER CREATEDB CREATEROLE;

-- CREATE DATABASE prisma_shadow_orchestration OWNER mediapulse;
-- CREATE DATABASE prisma_shadow_mediapulse OWNER mediapulse;
