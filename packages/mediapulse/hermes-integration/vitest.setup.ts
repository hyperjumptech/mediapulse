/**
 * Sets minimal env vars so database/env packages can load in tests.
 * Tests use mocked DB collaborators and do not connect to a real DB.
 */
const testDbBase = "postgresql://local:local@localhost:5432/test";
process.env.ORCHESTRATION_DATABASE_URL =
  process.env.ORCHESTRATION_DATABASE_URL ??
  `${testDbBase}?schema=orchestration`;
process.env.MEDIAPULSE_DATABASE_URL =
  process.env.MEDIAPULSE_DATABASE_URL ?? `${testDbBase}?schema=mediapulse`;
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? `${testDbBase}?schema=public`;
process.env.TEMP_ADMIN_USERNAME =
  process.env.TEMP_ADMIN_USERNAME ?? "test-admin";
process.env.TEMP_ADMIN_PASSWORD =
  process.env.TEMP_ADMIN_PASSWORD ?? "test-password";
