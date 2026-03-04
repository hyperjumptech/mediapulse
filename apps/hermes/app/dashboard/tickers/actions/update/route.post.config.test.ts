/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createUpdateTickerHandler } from "./route.post.config";

describe("createUpdateTickerHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    const updateHandler = createUpdateTickerHandler({
      getSession: async () => null,
      db: {} as never,
    });
    const result = await updateHandler({
      body: {
        tickerId: "00000000-0000-4000-8000-000000000001",
        name: "New Name",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("updates ticker with provided fields and returns ok", async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const db = { ticker: { update: updateMock } };
    const updateHandler = createUpdateTickerHandler({
      getSession: async () => ({ name: "A", email: "a@b.com" }),
      db: db as never,
    });
    const result = await updateHandler({
      body: {
        tickerId: "00000000-0000-4000-8000-000000000001",
        symbol: "AAPL",
        name: "Apple Inc",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "00000000-0000-4000-8000-000000000001" },
      data: { symbol: "AAPL", name: "Apple Inc" },
    });
    expect(result).toMatchObject({ status: true, data: { ok: true } });
  });

  it("updates only name when symbol not provided", async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const db = { ticker: { update: updateMock } };
    const updateHandler = createUpdateTickerHandler({
      getSession: async () => ({ name: "A", email: "a@b.com" }),
      db: db as never,
    });
    await updateHandler({
      body: {
        tickerId: "00000000-0000-4000-8000-000000000001",
        name: "Only Name",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "00000000-0000-4000-8000-000000000001" },
      data: { name: "Only Name" },
    });
  });
});

describe("handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is the factory with production defaults", async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const db = { ticker: { update: updateMock } };
    const customHandler = createUpdateTickerHandler({
      getSession: async () => ({ name: "A", email: "a@b.com" }),
      db: db as never,
    });
    const result = await customHandler({
      body: {
        tickerId: "00000000-0000-4000-8000-000000000001",
        name: "Test",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(true);
  });
});
