/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCreateAgentHandler } from "./route.post.config";

const mockDashboardUser = {
  id: "user-1",
  name: "A",
  email: "a@b.com",
} as const;

describe("createCreateAgentHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when agentId and agentVersion already exist", async () => {
    const findUniqueMock = vi.fn().mockResolvedValue({
      id: "existing-id",
      agentId: "summarizer",
      agentVersion: "1.0",
    });
    const db = {
      domainIntegration: {
        findFirst: vi.fn().mockResolvedValue({ id: "di-1" }),
      },
      agentRegistry: {
        findUnique: findUniqueMock,
        create: vi.fn(),
      },
    };
    const createHandler = createCreateAgentHandler({
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
      user: mockDashboardUser,
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
      domainIntegration: {
        findFirst: vi.fn().mockResolvedValue({ id: "di-1" }),
      },
      agentRegistry: {
        findUnique: findUniqueMock,
        create: createMock,
      },
    };
    const createHandler = createCreateAgentHandler({
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
      user: mockDashboardUser,
    } as never);
    expect(createMock).toHaveBeenCalledWith({
      data: {
        agentId: "summarizer",
        agentVersion: "1.0",
        description: "Test agent",
        endpoint: { url: "https://api.example.com" },
        isActive: true,
        domainIntegrationId: "di-1",
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
      domainIntegration: {
        findFirst: vi.fn().mockResolvedValue({ id: "di-1" }),
      },
      agentRegistry: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: createMock,
      },
    };
    const customHandler = createCreateAgentHandler({
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
      user: mockDashboardUser,
    } as never);
    expect(result.status).toBe(true);
  });
});
