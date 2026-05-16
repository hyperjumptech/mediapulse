/** @vitest-environment node */
import { afterEach, describe, it, expect, vi } from "vitest";

import { createUpdateAgentConfigHandler } from "./route.post.config";

const mockDashboardUser = {
  id: "u1",
  name: "Admin",
  email: "a@b.com",
} as const;

describe("createUpdateAgentConfigHandler", () => {
  const configId = "00000000-0000-4000-8000-000000000001";

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates config when schema uses Hermes textarea format on prompts", async () => {
    const updateMock = vi.fn().mockResolvedValue({});
    const configSchema = {
      type: "object",
      properties: {
        prompts: {
          type: "object",
          properties: {
            systemPrompt: { type: "string", format: "textarea" },
          },
        },
      },
    };
    const mockDb = {
      agentConfig: {
        findUnique: vi.fn().mockResolvedValue({
          id: configId,
          name: "Query Analysis Config",
        }),
        update: updateMock,
      },
      agentRegistry: {
        findFirst: vi.fn().mockResolvedValue({
          id: "ar1",
          configSchema,
        }),
      },
    };
    const handler = createUpdateAgentConfigHandler({
      db: mockDb as never,
    });

    const result = await handler({
      body: {
        id: configId,
        name: "Query Analysis Config",
        agentId: "query-analysis",
        agentVersion: "1.0.0",
        config: {
          prompts: { systemPrompt: "Updated\nprompt" },
        },
      },
      user: mockDashboardUser,
      params: {},
      headers: new Headers(),
      searchParams: {},
    } as never);

    expect(result.status).toBe(true);
    expect(updateMock).toHaveBeenCalled();
  });
});
