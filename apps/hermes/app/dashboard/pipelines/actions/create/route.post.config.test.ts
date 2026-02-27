/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createCreatePipelineHandler,
  requestValidator,
} from "./route.post.config";

describe("createCreatePipelineHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    const createHandler = createCreatePipelineHandler({
      getSession: async () => null,
      db: {} as never,
    });

    const result = await createHandler({
      body: { name: "Test", isActive: true },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);

    expect(result.status).toBe(false);
    expect((result as { status: false; message?: string }).message).toBe(
      "Unauthorized",
    );
  });

  it("creates pipeline and returns id when session exists", async () => {
    const created = {
      id: "pipeline-uuid-123",
      name: "P",
      description: null,
      isActive: true,
    };
    const db = {
      pipeline: {
        create: vi.fn().mockResolvedValue(created),
      },
    };

    const createHandler = createCreatePipelineHandler({
      getSession: async () => ({ name: "Admin", email: "admin@example.com" }),
      db: db as never,
    });

    const result = await createHandler({
      body: { name: "My Pipeline", description: "Desc", isActive: true },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);

    expect(db.pipeline.create).toHaveBeenCalledWith({
      data: {
        name: "My Pipeline",
        description: "Desc",
        isActive: true,
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
      pipeline: {
        create: vi.fn().mockResolvedValue(created),
      },
    };

    const createHandler = createCreatePipelineHandler({
      getSession: async () => ({ name: "A", email: "a@b.com" }),
      db: db as never,
    });

    await createHandler({
      body: { name: "Minimal" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);

    expect(db.pipeline.create).toHaveBeenCalledWith({
      data: {
        name: "Minimal",
        description: null,
        isActive: true,
      },
    });
  });
});

describe("requestValidator", () => {
  it("accepts valid body with name only", async () => {
    const result = await requestValidator.body?.parseAsync({ name: "P" });
    expect(result).toEqual({ name: "P", isActive: true });
  });

  it("accepts valid body with name, description, isActive", async () => {
    const result = await requestValidator.body?.parseAsync({
      name: "P",
      description: "D",
      isActive: false,
    });
    expect(result).toEqual({ name: "P", description: "D", isActive: false });
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
      pipeline: {
        create: vi.fn().mockResolvedValue({
          id: "default-id",
          name: "X",
          description: null,
          isActive: true,
        }),
      },
    };
    const getSession = vi
      .fn()
      .mockResolvedValue({ name: "A", email: "a@b.com" });
    const customHandler = createCreatePipelineHandler({
      getSession,
      db: db as never,
    });
    const result = await customHandler({
      body: { name: "Default", isActive: true },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);

    expect(result.status).toBe(true);
    expect((result as { data?: { id: string } }).data?.id).toBe("default-id");
  });
});
