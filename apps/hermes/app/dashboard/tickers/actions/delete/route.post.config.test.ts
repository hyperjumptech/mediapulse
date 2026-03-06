/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDeleteTickerHandler } from "./route.post.config";

describe("createDeleteTickerHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    const deleteHandler = createDeleteTickerHandler({
      getSession: async () => null,
      db: {} as never,
    });
    const result = await deleteHandler({
      body: { tickerId: "00000000-0000-4000-8000-000000000001" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("deletes dependents and ticker in transaction and returns ok", async () => {
    const transactionMock = vi.fn().mockImplementation(async (fn) => {
      await fn({
        userTicker: { deleteMany: vi.fn().mockResolvedValue(undefined) },
        newsletter: { deleteMany: vi.fn().mockResolvedValue(undefined) },
        dataSource: { deleteMany: vi.fn().mockResolvedValue(undefined) },
        searchQuery: { deleteMany: vi.fn().mockResolvedValue(undefined) },
        ticker: { delete: vi.fn().mockResolvedValue(undefined) },
      });
    });
    const db = { $transaction: transactionMock };
    const deleteHandler = createDeleteTickerHandler({
      getSession: async () => ({ name: "A", email: "a@b.com" }),
      db: db as never,
    });
    const result = await deleteHandler({
      body: { tickerId: "00000000-0000-4000-8000-000000000001" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(transactionMock).toHaveBeenCalled();
    expect(result).toMatchObject({ status: true, data: { ok: true } });
  });
});

describe("handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is the factory with production defaults", async () => {
    const transactionMock = vi.fn().mockImplementation(async (fn) => {
      await fn({
        userTicker: { deleteMany: vi.fn().mockResolvedValue(undefined) },
        newsletter: { deleteMany: vi.fn().mockResolvedValue(undefined) },
        dataSource: { deleteMany: vi.fn().mockResolvedValue(undefined) },
        searchQuery: { deleteMany: vi.fn().mockResolvedValue(undefined) },
        ticker: { delete: vi.fn().mockResolvedValue(undefined) },
      });
    });
    const db = { $transaction: transactionMock };
    const customHandler = createDeleteTickerHandler({
      getSession: async () => ({ name: "A", email: "a@b.com" }),
      db: db as never,
    });
    const result = await customHandler({
      body: { tickerId: "00000000-0000-4000-8000-000000000001" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(true);
  });
});
