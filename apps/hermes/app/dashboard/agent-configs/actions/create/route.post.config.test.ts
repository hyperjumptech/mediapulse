/** @vitest-environment node */
import { afterEach, describe, it, expect, vi } from "vitest";

import { createCreateAgentConfigHandler } from "./route.post.config";

describe("createCreateAgentConfigHandler", () => {
  const mockSession = { id: "u1", email: "a@b.com", role: "ADMIN" as const };

  const validBody = {
    name: "My Config",
    description: "Test",
    agentId: "ag1",
    agentVersion: "1.0",
    config: { limit: 10 },
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns Unauthorized when no session", async () => {
    const mockDb = {
      agentRegistry: { findFirst: vi.fn() },
      agentConfig: { create: vi.fn() },
    };
    const getSession = vi.fn().mockResolvedValue(null);
    const handler = createCreateAgentConfigHandler({
      getSession,
      db: mockDb as never,
    });

    const result = await handler({
      body: validBody,
      user: undefined,
      params: {},
      headers: new Headers(),
      searchParams: {},
    } as never);

    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("returns error when agent not found", async () => {
    const mockDb = {
      agentRegistry: { findFirst: vi.fn().mockResolvedValue(null) },
      agentConfig: { create: vi.fn() },
    };
    const getSession = vi.fn().mockResolvedValue(mockSession);
    const handler = createCreateAgentConfigHandler({
      getSession,
      db: mockDb as never,
    });

    const result = await handler({
      body: validBody,
      user: mockSession,
      params: {},
      headers: new Headers(),
      searchParams: {},
    } as never);

    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toContain(
      "not found in registry",
    );
  });

  it("creates config and returns id when agent exists and config valid", async () => {
    const createMock = vi.fn().mockResolvedValue({ id: "ac1" });
    const mockDb = {
      agentRegistry: {
        findFirst: vi.fn().mockResolvedValue({
          id: "ar1",
          configSchema: {
            type: "object",
            properties: { limit: { type: "number" } },
          },
        }),
      },
      agentConfig: { create: createMock },
    };
    const getSession = vi.fn().mockResolvedValue(mockSession);
    const handler = createCreateAgentConfigHandler({
      getSession,
      db: mockDb as never,
    });

    const result = await handler({
      body: validBody,
      user: mockSession,
      params: {},
      headers: new Headers(),
      searchParams: {},
    } as never);

    expect(result.status).toBe(true);
    expect((result as { data?: { id: string } }).data?.id).toBe("ac1");
    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "My Config",
        description: "Test",
        agentId: "ag1",
        agentVersion: "1.0",
        config: { limit: 10 },
        configSchemaFingerprint: expect.any(String),
      }),
    });
  });
});
