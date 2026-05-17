/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@hermes/env", () => ({
  env: { HERMES_MCP_API_KEY_PEPPER: "test-pepper" },
}));

vi.mock("@hermes/orchestration-database", () => ({
  prisma: { mcpApiKey: {}, user: {} },
}));

import { createRevokeMcpApiKeyHandler, handler } from "./route.post.config";

const sessionUser = {
  id: "admin-1",
  name: "Admin",
  email: "admin@test.com",
  credentialVersion: 0,
};

describe("revoke MCP API key route.post.config", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ok when revoke succeeds", async () => {
    const revoke = vi.fn().mockResolvedValue(true);
    const result = await createRevokeMcpApiKeyHandler({ revoke })({
      body: { id: "key-1" },
      user: sessionUser,
    } as never);

    expect(result.status).toBe(true);
    if (result.status === true) {
      expect(result.data).toEqual({ ok: true });
    }
    expect(revoke).toHaveBeenCalledWith("key-1", "admin-1");
  });

  it("returns error when key already revoked", async () => {
    const revoke = vi.fn().mockResolvedValue(false);
    const result = await createRevokeMcpApiKeyHandler({ revoke })({
      body: { id: "missing" },
      user: sessionUser,
    } as never);

    expect(result.status).toBe(false);
  });

  it("exports handler", () => {
    expect(handler).toBeDefined();
  });
});
