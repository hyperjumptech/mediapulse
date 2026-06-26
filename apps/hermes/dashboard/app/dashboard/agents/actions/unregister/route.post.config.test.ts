/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createUnregisterAgentHandler } from "./route.post.config";

const mockDashboardUser = {
  id: "user-1",
  name: "A",
  email: "a@b.com",
} as const;

describe("createUnregisterAgentHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("unregisters the agent and returns ok", async () => {
    const deleteMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      agentRegistry: { delete: deleteMock },
    };
    const handler = createUnregisterAgentHandler({
      db: db as never,
    });
    const result = await handler({
      body: { id: "00000000-0000-4000-8000-000000000001" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);

    expect(deleteMock).toHaveBeenCalledWith({
      where: { id: "00000000-0000-4000-8000-000000000001" },
    });
    expect(result).toMatchObject({ status: true, data: { ok: true } });
  });
});
