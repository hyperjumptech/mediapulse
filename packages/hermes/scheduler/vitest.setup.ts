/**
 * Sets minimal env vars so @hermes/orchestration-database (and thus @hermes/env) can load in tests.
 * Tests use mocked DB; no real DB connection is made.
 */
const testDbBase = "postgresql://local:local@localhost:5432/test";
process.env.ORCHESTRATION_DATABASE_URL =
  process.env.ORCHESTRATION_DATABASE_URL ??
  `${testDbBase}?schema=orchestration`;
process.env.MEDIAPULSE_DATABASE_URL =
  process.env.MEDIAPULSE_DATABASE_URL ?? `${testDbBase}?schema=mediapulse`;
process.env.TEMP_ADMIN_USERNAME =
  process.env.TEMP_ADMIN_USERNAME ?? "test-admin";
process.env.TEMP_ADMIN_PASSWORD =
  process.env.TEMP_ADMIN_PASSWORD ?? "test-password";
