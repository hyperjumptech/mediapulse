/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createUpdateApiKeyHandler } from "./route.post.config";

const apiKeyId = "00000000-0000-4000-8000-000000000001";

const baseData = {
  body: { id: apiKeyId, name: "Updated Name", isActive: false },
  params: {},
  headers: new Headers(),
  searchParams: {},
  user: undefined,
} as never;

describe("createUpdateApiKeyHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    const updateHandler = createUpdateApiKeyHandler({
      getSession: async () => null,
      db: {} as never,
    });
    const result = await updateHandler(baseData);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("returns error when API key not found", async () => {
    const db = {
      aPIKey: {
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
    };
    const updateHandler = createUpdateApiKeyHandler({
      getSession: async () => ({
        id: "user-1",
        name: "Admin",
        email: "a@b.com",
      }),
      db: db as never,
    });
    const result = await updateHandler(baseData);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("API key not found");
  });

  it("updates name and isActive and returns ok", async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      aPIKey: {
        findUnique: vi.fn().mockResolvedValue({
          id: apiKeyId,
          name: "Old",
          isActive: true,
        }),
        update: updateMock,
      },
    };
    const updateHandler = createUpdateApiKeyHandler({
      getSession: async () => ({
        id: "user-1",
        name: "Admin",
        email: "a@b.com",
      }),
      db: db as never,
    });
    const result = await updateHandler(baseData);

    expect(result.status).toBe(true);
    expect((result as { data?: { ok: boolean } }).data?.ok).toBe(true);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: apiKeyId },
      data: { name: "Updated Name", isActive: false },
    });
  });
});

describe("handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is the factory with production defaults", async () => {
    const db = {
      aPIKey: {
        findUnique: vi.fn().mockResolvedValue({ id: apiKeyId }),
        update: vi.fn().mockResolvedValue(undefined),
      },
    };
    const updateHandler = createUpdateApiKeyHandler({
      getSession: async () => ({ id: "user-1", name: "A", email: "a@b.com" }),
      db: db as never,
    });
    const result = await updateHandler(baseData);
    expect(result.status).toBe(true);
  });
});
