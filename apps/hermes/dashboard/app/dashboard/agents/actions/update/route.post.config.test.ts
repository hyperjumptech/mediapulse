/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createUpdateAgentHandler } from "./route.post.config";

describe("createUpdateAgentHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    const updateHandler = createUpdateAgentHandler({
      getSession: async () => null,
      db: {} as never,
    });
    const result = await updateHandler({
      body: { id: "00000000-0000-4000-8000-000000000001" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("returns error when agent not found and agentId/version provided", async () => {
    const findUniqueMock = vi.fn().mockResolvedValue(null);
    const db = {
      agentRegistry: {
        findUnique: findUniqueMock,
        update: vi.fn(),
      },
    };
    const updateHandler = createUpdateAgentHandler({
      getSession: async () => ({ id: "user-1", name: "A", email: "a@b.com" }),
      db: db as never,
    });
    const result = await updateHandler({
      body: {
        id: "00000000-0000-4000-8000-000000000001",
        agentId: "new-id",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Agent not found");
  });

  it("updates agent with provided fields and returns ok", async () => {
    const findUniqueMock = vi
      .fn()
      .mockResolvedValueOnce({
        id: "00000000-0000-4000-8000-000000000001",
        agentId: "old",
        agentVersion: "1.0",
      })
      .mockResolvedValue(null);
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      agentRegistry: {
        findUnique: findUniqueMock,
        update: updateMock,
      },
    };
    const updateHandler = createUpdateAgentHandler({
      getSession: async () => ({ id: "user-1", name: "A", email: "a@b.com" }),
      db: db as never,
    });
    const result = await updateHandler({
      body: {
        id: "00000000-0000-4000-8000-000000000001",
        agentId: "summarizer",
        agentVersion: "2.0",
        description: "Updated",
        isActive: false,
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "00000000-0000-4000-8000-000000000001" },
      data: {
        agentId: "summarizer",
        agentVersion: "2.0",
        description: "Updated",
        isActive: false,
      },
    });
    expect(result).toMatchObject({ status: true, data: { ok: true } });
  });

  it("updates only description when other fields not provided", async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      agentRegistry: {
        findUnique: vi.fn(),
        update: updateMock,
      },
    };
    const updateHandler = createUpdateAgentHandler({
      getSession: async () => ({ id: "user-1", name: "A", email: "a@b.com" }),
      db: db as never,
    });
    await updateHandler({
      body: {
        id: "00000000-0000-4000-8000-000000000001",
        description: "New description",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "00000000-0000-4000-8000-000000000001" },
      data: { description: "New description" },
    });
  });
});

describe("handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is the factory with production defaults", async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      agentRegistry: {
        findUnique: vi.fn(),
        update: updateMock,
      },
    };
    const customHandler = createUpdateAgentHandler({
      getSession: async () => ({ id: "user-1", name: "A", email: "a@b.com" }),
      db: db as never,
    });
    const result = await customHandler({
      body: {
        id: "00000000-0000-4000-8000-000000000001",
        isActive: false,
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(true);
  });
});
