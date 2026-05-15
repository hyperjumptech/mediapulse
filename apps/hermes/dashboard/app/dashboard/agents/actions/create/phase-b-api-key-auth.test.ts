/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createCreateAgentHandler,
  handler,
} from "./route.post.config";

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
    const createAgent = vi.fn().mockResolvedValue({ id: "agent-1" });
    const result = await createCreateAgentHandler({
      createAgent,
    } as never)({
      body: {
        agentId: "test-agent",
        agentVersion: "1.0.0",
        domainIntegrationId: "int-1",
      },
      user: apiKeyUser,
    } as never);

    expect(result.status).toBe(true);
    if (result.status === true) {
      expect(result.data).toEqual({ id: "agent-1" });
    }
  });
});
