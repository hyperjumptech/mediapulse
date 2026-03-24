/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDeleteAgentHandler } from "./route.post.config";

const mockDashboardUser = {
  id: "user-1",
  name: "A",
  email: "a@b.com",
} as const;

describe("createDeleteAgentHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes agent and returns ok", async () => {
    const deleteMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      agentRegistry: { delete: deleteMock },
    };
    const deleteHandler = createDeleteAgentHandler({
      db: db as never,
    });
    const result = await deleteHandler({
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

describe("handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is the factory with production defaults", async () => {
    const deleteMock = vi.fn().mockResolvedValue(undefined);
    const db = { agentRegistry: { delete: deleteMock } };
    const customHandler = createDeleteAgentHandler({
      db: db as never,
    });
    const result = await customHandler({
      body: { id: "00000000-0000-4000-8000-000000000001" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);
    expect(result.status).toBe(true);
  });
});
