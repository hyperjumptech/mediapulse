/**
 * Minimal env so `@workspace/env` validates when crypto tests load modules.
 */
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://local:local@localhost:5432/test";
process.env.TEMP_ADMIN_USERNAME =
  process.env.TEMP_ADMIN_USERNAME ?? "test-admin";
process.env.TEMP_ADMIN_PASSWORD =
  process.env.TEMP_ADMIN_PASSWORD ?? "test-password";
process.env.REGISTERED_DATABASE_ENCRYPTION_KEY =
  process.env.REGISTERED_DATABASE_ENCRYPTION_KEY ??
  Buffer.alloc(32, 7).toString("base64");
