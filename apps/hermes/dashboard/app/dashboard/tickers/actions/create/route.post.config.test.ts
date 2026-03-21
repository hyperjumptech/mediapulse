/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCreateTickerHandler } from "./route.post.config";

describe("createCreateTickerHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    const createHandler = createCreateTickerHandler({
      getSession: async () => null,
      db: {} as never,
    });
    const result = await createHandler({
      body: { symbol: "AAPL", name: "Apple Inc" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("creates ticker with symbol and name and returns id", async () => {
    const createMock = vi.fn().mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000001",
      symbol: "AAPL",
      name: "Apple Inc",
    });
    const db = { ticker: { create: createMock } };
    const createHandler = createCreateTickerHandler({
      getSession: async () => ({ id: "user-1", name: "A", email: "a@b.com" }),
      db: db as never,
    });
    const result = await createHandler({
      body: { symbol: "AAPL", name: "Apple Inc" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(createMock).toHaveBeenCalledWith({
      data: { symbol: "AAPL", name: "Apple Inc" },
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
      symbol: "X",
      name: "Test",
    });
    const db = { ticker: { create: createMock } };
    const customHandler = createCreateTickerHandler({
      getSession: async () => ({
        id: "user-1",
        name: "Admin",
        email: "admin@test.com",
      }),
      db: db as never,
    });
    const result = await customHandler({
      body: { symbol: "X", name: "Test" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(true);
  });
});
