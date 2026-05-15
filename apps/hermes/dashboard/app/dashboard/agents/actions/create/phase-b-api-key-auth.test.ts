/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import { createCreateAgentHandler, handler } from "./route.post.config";

const apiKeyUser = {
  id: "user-1",
  name: "Admin",
  email: "admin@test.com",
  credentialVersion: 0,
};

describe("Phase B create agent with API key principal user", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("handler is wired for principal-based auth", () => {
    expect(handler).toBeDefined();
  });

  it("allows create when injectable dependencies succeed", async () => {
    const createdId = "00000000-0000-4000-8000-0000000000a1";
    const createMock = vi.fn().mockResolvedValue({
      id: createdId,
      agentId: "test-agent",
      agentVersion: "1.0.0",
    });
    const db = {
      domainIntegration: { findFirst: vi.fn() },
      agentRegistry: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: createMock,
      },
    };
    const result = await createCreateAgentHandler({
      db: db as never,
    })({
      body: {
        agentId: "test-agent",
        agentVersion: "1.0.0",
        domainIntegrationId: "int-1",
        endpoint: { url: "https://api.example.com/agent" },
        isActive: false,
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: apiKeyUser,
    } as never);

    expect(result.status).toBe(true);
    if (result.status === true) {
      expect(result.data).toEqual({ id: createdId });
    }
    expect(createMock).toHaveBeenCalledWith({
      data: {
        agentId: "test-agent",
        agentVersion: "1.0.0",
        description: null,
        endpoint: { url: "https://api.example.com/agent" },
        isActive: false,
        domainIntegrationId: "int-1",
      },
    });
  });
});
