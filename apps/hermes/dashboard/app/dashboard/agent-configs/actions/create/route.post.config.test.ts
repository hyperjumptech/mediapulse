/** @vitest-environment node */
import { afterEach, describe, it, expect, vi } from "vitest";

import { createCreateAgentConfigHandler } from "./route.post.config";

const mockDashboardUser = {
  id: "u1",
  name: "Admin",
  email: "a@b.com",
} as const;

describe("createCreateAgentConfigHandler", () => {
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

  it("returns error when agent not found", async () => {
    const mockDb = {
      agentRegistry: { findFirst: vi.fn().mockResolvedValue(null) },
      agentConfig: { create: vi.fn() },
    };
    const handler = createCreateAgentConfigHandler({
      db: mockDb as never,
    });

    const result = await handler({
      body: validBody,
      user: mockDashboardUser,
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
    const handler = createCreateAgentConfigHandler({
      db: mockDb as never,
    });

    const result = await handler({
      body: validBody,
      user: mockDashboardUser,
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
