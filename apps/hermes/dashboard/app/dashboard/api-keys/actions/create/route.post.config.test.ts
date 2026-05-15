/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@hermes/env", () => ({
  env: { HERMES_MCP_API_KEY_PEPPER: "test-pepper" },
}));

vi.mock("@hermes/orchestration-database", () => ({
  prisma: { mcpApiKey: {}, user: {} },
}));

import {
  createCreateMcpApiKeyHandler,
  handler,
  requestValidator,
} from "./route.post.config";

const sessionUser = {
  id: "user-1",
  name: "Admin",
  email: "admin@test.com",
  credentialVersion: 0,
};

describe("create MCP API key route.post.config", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns plaintext key on success", async () => {
    const createKey = vi.fn().mockResolvedValue({
      id: "key-1",
      label: "Cursor",
      readOnly: false,
      createdByUserId: "user-1",
      apiKeyPlaintext: "hmcp_ab_secret",
    });

    const result = await createCreateMcpApiKeyHandler({ createKey })({
      body: { label: "Cursor", readOnly: false },
      user: sessionUser,
    } as never);

    expect(result.status).toBe(true);
    if (result.status === true) {
      expect(result.data.apiKeyPlaintext).toBe("hmcp_ab_secret");
    }
    expect(createKey).toHaveBeenCalledWith({
      label: "Cursor",
      readOnly: false,
      createdByUserId: "user-1",
    });
  });

  it("returns error when create fails", async () => {
    const createKey = vi
      .fn()
      .mockRejectedValue(
        new Error("MCP API keys can only be created by an active Hermes admin"),
      );

    const result = await createCreateMcpApiKeyHandler({ createKey })({
      body: { label: "x", readOnly: true },
      user: sessionUser,
    } as never);

    expect(result.status).toBe(false);
  });

  it("exports handler wired to default create", () => {
    expect(handler).toBeDefined();
    expect(requestValidator).toBeDefined();
  });
});
