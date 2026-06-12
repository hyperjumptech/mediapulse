const testDbBase = "postgresql://local:local@localhost:5432/test";
process.env.ORCHESTRATION_DATABASE_URL =
  process.env.ORCHESTRATION_DATABASE_URL ??
  `${testDbBase}?schema=orchestration`;
process.env.AGENT_AUTH_API_URL =
  process.env.AGENT_AUTH_API_URL ?? "http://localhost:8080";
process.env.AGENT_AUTH_JWT_SECRET =
  process.env.AGENT_AUTH_JWT_SECRET ?? "test-jwt-secret";
process.env.TEMP_ADMIN_USERNAME =
  process.env.TEMP_ADMIN_USERNAME ?? "test-admin";
process.env.TEMP_ADMIN_PASSWORD =
  process.env.TEMP_ADMIN_PASSWORD ?? "test-password";
process.env.HERMES_INTERNAL_API_KEY =
  process.env.HERMES_INTERNAL_API_KEY ?? "test-hermes-internal-api-key";
process.env.HERMES_MCP_API_KEY_PEPPER =
  process.env.HERMES_MCP_API_KEY_PEPPER ?? "test-mcp-api-key-pepper";
