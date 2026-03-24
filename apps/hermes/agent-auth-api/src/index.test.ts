/** @vitest-environment node */
import { describe, expect, it } from "vitest";

process.env.ORCHESTRATION_DATABASE_URL ??=
  "postgresql://localhost:5432/test?schema=orchestration";
process.env.HERMES_INTERNAL_API_KEY ??= "test-internal-key-for-index-test";
process.env.TEMP_ADMIN_USERNAME ??= "test-admin";
process.env.TEMP_ADMIN_PASSWORD ??= "test-password";

describe("agent-auth-api", () => {
  it("exports a fetch handler", async () => {
    const { default: app } = await import("./index.js");
    expect(typeof app.fetch).toBe("function");
  });
});
