/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

/**
 * The real `@hermes/orchestration-database` client constructs a `pg` Pool on import. With no
 * Postgres listening (typical in CI), the first connection attempt can sit until
 * `connectionTimeoutMillis` (~5s), which races Vitest’s default `testTimeout` and flakes.
 */
vi.mock("@hermes/orchestration-database", () => ({
  prisma: {
    encryptedPayload: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@hermes/env", () => ({
  env: {
    ORCHESTRATION_DATABASE_URL:
      "postgresql://localhost:5432/test?schema=orchestration",
    AGENT_AUTH_API_URL: "http://localhost:8080",
    AGENT_AUTH_JWT_SECRET: "test-jwt-secret-for-index-test-at-least-16-chars",
    HERMES_INTERNAL_API_KEY: "test-internal-key-for-index-test",
    TEMP_ADMIN_USERNAME: "test-admin",
    TEMP_ADMIN_PASSWORD: "test-password",
    PORT: 8080,
  },
}));

describe("agent-auth-api", () => {
  it("exports a fetch handler", async () => {
    const mod = await import("./index.js");
    expect(typeof mod.agentAuthApiServer.fetch).toBe("function");
    expect(mod.default).toBe(mod.agentAuthApiServer);
  });
});
