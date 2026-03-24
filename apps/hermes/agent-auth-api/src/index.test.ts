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

process.env.ORCHESTRATION_DATABASE_URL ??=
  "postgresql://localhost:5432/test?schema=orchestration";
process.env.HERMES_INTERNAL_API_KEY ??= "test-internal-key-for-index-test";
process.env.TEMP_ADMIN_USERNAME ??= "test-admin";
process.env.TEMP_ADMIN_PASSWORD ??= "test-password";

describe("agent-auth-api", () => {
  it("exports a fetch handler", async () => {
    const mod = await import("./index.js");
    expect(typeof mod.agentAuthApiServer.fetch).toBe("function");
    expect(mod.default).toBe(mod.agentAuthApiServer);
  });
});
