/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createCreatePipelineHandler,
  requestValidator,
} from "./route.post.config";

const mockDashboardUser = {
  id: "user-1",
  name: "A",
  email: "a@b.com",
} as const;

describe("createCreatePipelineHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates pipeline and returns id when session exists", async () => {
    const created = {
      id: "pipeline-uuid-123",
      name: "P",
      description: null,
      isActive: true,
    };
    const db = {
      domainIntegration: {
        findFirst: vi.fn().mockResolvedValue({ id: "di-1" }),
      },
      pipeline: {
        create: vi.fn().mockResolvedValue(created),
      },
    };

    const createHandler = createCreatePipelineHandler({
      db: db as never,
    });

    const result = await createHandler({
      body: { name: "My Pipeline", description: "Desc", isActive: true },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);

    expect(db.pipeline.create).toHaveBeenCalledWith({
      data: {
        name: "My Pipeline",
        description: "Desc",
        isActive: true,
        domainIntegrationId: "di-1",
        createdById: mockDashboardUser.id,
        timeout: null,
      },
    });
    expect(result).toMatchObject({
      status: true,
      data: { id: "pipeline-uuid-123" },
    });
  });

  it("defaults description to null and isActive to true", async () => {
    const created = {
      id: "id-1",
      name: "P",
      description: null,
      isActive: true,
    };
    const db = {
      domainIntegration: {
        findFirst: vi.fn().mockResolvedValue({ id: "di-1" }),
      },
      pipeline: {
        create: vi.fn().mockResolvedValue(created),
      },
    };

    const createHandler = createCreatePipelineHandler({
      db: db as never,
    });

    await createHandler({
      body: { name: "Minimal" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);

    expect(db.pipeline.create).toHaveBeenCalledWith({
      data: {
        name: "Minimal",
        description: null,
        isActive: true,
        domainIntegrationId: "di-1",
        createdById: mockDashboardUser.id,
        timeout: null,
      },
    });
  });

  it("persists optional agent timeout when provided", async () => {
    const db = {
      domainIntegration: {
        findFirst: vi.fn().mockResolvedValue({ id: "di-1" }),
      },
      pipeline: {
        create: vi.fn().mockResolvedValue({
          id: "id-timeout",
          name: "P",
          description: null,
          isActive: true,
        }),
      },
    };
    const createHandler = createCreatePipelineHandler({
      db: db as never,
    });

    await createHandler({
      body: { name: "P", timeout: 900_000 },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);

    expect(db.pipeline.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ timeout: 900_000 }),
      }),
    );
  });
});

describe("requestValidator", () => {
  it("accepts valid body with name only", async () => {
    const result = await requestValidator.body?.parseAsync({ name: "P" });
    expect(result).toEqual({ name: "P", isActive: true, timeout: null });
  });

  it("accepts valid body with name, description, isActive", async () => {
    const result = await requestValidator.body?.parseAsync({
      name: "P",
      description: "D",
      isActive: false,
    });
    expect(result).toEqual({
      name: "P",
      description: "D",
      isActive: false,
      timeout: null,
    });
  });

  it("rejects empty name", async () => {
    await expect(
      requestValidator.body?.parseAsync({ name: "" }),
    ).rejects.toThrow();
  });
});

describe("handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is the factory with production defaults", async () => {
    const db = {
      domainIntegration: {
        findFirst: vi.fn().mockResolvedValue({ id: "di-1" }),
      },
      pipeline: {
        create: vi.fn().mockResolvedValue({
          id: "default-id",
          name: "X",
          description: null,
          isActive: true,
        }),
      },
    };
    const customHandler = createCreatePipelineHandler({
      db: db as never,
    });
    const result = await customHandler({
      body: { name: "Default", isActive: true },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);

    expect(result.status).toBe(true);
    expect((result as { data?: { id: string } }).data?.id).toBe("default-id");
  });
});
