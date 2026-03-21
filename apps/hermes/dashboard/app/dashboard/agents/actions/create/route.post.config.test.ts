/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCreateAgentHandler } from "./route.post.config";

describe("createCreateAgentHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    const createHandler = createCreateAgentHandler({
      getSession: async () => null,
      db: {} as never,
    });
    const result = await createHandler({
      body: {
        agentId: "summarizer",
        agentVersion: "1.0",
        endpoint: "{}",
        isActive: true,
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("returns error when agentId and agentVersion already exist", async () => {
    const findUniqueMock = vi.fn().mockResolvedValue({
      id: "existing-id",
      agentId: "summarizer",
      agentVersion: "1.0",
    });
    const db = {
      agentRegistry: {
        findUnique: findUniqueMock,
        create: vi.fn(),
      },
    };
    const createHandler = createCreateAgentHandler({
      getSession: async () => ({ id: "user-1", name: "A", email: "a@b.com" }),
      db: db as never,
    });
    const result = await createHandler({
      body: {
        agentId: "summarizer",
        agentVersion: "1.0",
        endpoint: "{}",
        isActive: true,
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toContain(
      "already exists",
    );
  });

  it("creates agent and returns id", async () => {
    const findUniqueMock = vi.fn().mockResolvedValue(null);
    const createMock = vi.fn().mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000001",
      agentId: "summarizer",
      agentVersion: "1.0",
    });
    const db = {
      agentRegistry: {
        findUnique: findUniqueMock,
        create: createMock,
      },
    };
    const createHandler = createCreateAgentHandler({
      getSession: async () => ({ id: "user-1", name: "A", email: "a@b.com" }),
      db: db as never,
    });
    const result = await createHandler({
      body: {
        agentId: "summarizer",
        agentVersion: "1.0",
        description: "Test agent",
        endpoint: { url: "https://api.example.com" },
        isActive: true,
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(createMock).toHaveBeenCalledWith({
      data: {
        agentId: "summarizer",
        agentVersion: "1.0",
        description: "Test agent",
        endpoint: { url: "https://api.example.com" },
        isActive: true,
      },
    });
    expect(result).toMatchObject({
      status: true,
      data: { id: "00000000-0000-4000-8000-000000000001" },
    });
  });
});

describe("handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is the factory with production defaults", async () => {
    const createMock = vi.fn().mockResolvedValue({
      id: "uuid-1",
      agentId: "x",
      agentVersion: "1",
    });
    const db = {
      agentRegistry: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: createMock,
      },
    };
    const customHandler = createCreateAgentHandler({
      getSession: async () => ({
        id: "user-1",
        name: "Admin",
        email: "admin@test.com",
      }),
      db: db as never,
    });
    const result = await customHandler({
      body: {
        agentId: "x",
        agentVersion: "1",
        endpoint: "{}",
        isActive: true,
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(true);
  });
});
