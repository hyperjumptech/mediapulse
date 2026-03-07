/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCreateApiKeyHandler } from "./route.post.config";

const baseData = {
  body: { name: "My API Key" },
  params: {},
  headers: new Headers(),
  searchParams: {},
  user: undefined,
} as never;

describe("createCreateApiKeyHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    const createHandler = createCreateApiKeyHandler({
      getSession: async () => null,
      db: {} as never,
    });
    const result = await createHandler(baseData);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("returns error when user not found for session email", async () => {
    const db = {
      user: { findUnique: vi.fn().mockResolvedValue(null) },
      aPIKey: { create: vi.fn() },
    };
    const createHandler = createCreateApiKeyHandler({
      getSession: async () => ({ name: "Admin", email: "unknown@example.com" }),
      db: db as never,
    });
    const result = await createHandler(baseData);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("User not found");
    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { email: "unknown@example.com" },
    });
  });

  it("creates API key with hashed key and returns id and raw key", async () => {
    const createMock = vi.fn().mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000001",
    });
    const db = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "user-uuid",
          name: "Admin",
          email: "admin@example.com",
        }),
      },
      aPIKey: { create: createMock },
    };
    const createHandler = createCreateApiKeyHandler({
      getSession: async () => ({ name: "Admin", email: "admin@example.com" }),
      db: db as never,
    });
    const result = await createHandler(baseData);

    expect(result.status).toBe(true);
    expect((result as { data?: { id: string; key: string } }).data?.id).toBe(
      "00000000-0000-4000-8000-000000000001",
    );
    const rawKey = (result as { data?: { key: string } }).data?.key;
    expect(rawKey).toBeDefined();
    expect(typeof rawKey).toBe("string");
    expect(rawKey!.length).toBeGreaterThan(0);

    expect(createMock).toHaveBeenCalledTimes(1);
    const createCall = createMock.mock.calls[0] as [
      { data: { name: string; key: string; userId: string } },
    ];
    expect(createCall[0].data.name).toBe("My API Key");
    expect(createCall[0].data.userId).toBe("user-uuid");
    const storedHash = createCall[0].data.key;
    expect(storedHash).toMatch(/^[a-f0-9]{64}$/);
    expect(storedHash).not.toBe(rawKey);
  });
});

describe("handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is the factory with production defaults", async () => {
    const createMock = vi.fn().mockResolvedValue({
      id: "key-uuid",
    });
    const db = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "user-id",
          name: "U",
          email: "u@x.com",
        }),
      },
      aPIKey: { create: createMock },
    };
    const createHandler = createCreateApiKeyHandler({
      getSession: async () => ({ name: "U", email: "u@x.com" }),
      db: db as never,
    });
    const result = await createHandler({
      body: { name: "Test" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(true);
    expect((result as { data?: { id: string } }).data?.id).toBe("key-uuid");
  });
});
