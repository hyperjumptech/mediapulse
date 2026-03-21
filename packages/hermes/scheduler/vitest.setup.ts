/**
 * Sets minimal env vars so @workspace/database (and thus @workspace/env) can load in tests.
 * Tests use mocked DB; no real DB connection is made.
 */
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://local:local@localhost:5432/test";
process.env.TEMP_ADMIN_USERNAME =
  process.env.TEMP_ADMIN_USERNAME ?? "test-admin";
process.env.TEMP_ADMIN_PASSWORD =
  process.env.TEMP_ADMIN_PASSWORD ?? "test-password";
