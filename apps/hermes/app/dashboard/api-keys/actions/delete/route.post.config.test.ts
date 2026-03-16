/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDeleteApiKeyHandler } from "./route.post.config";

const apiKeyId = "00000000-0000-4000-8000-000000000001";

const baseData = {
  body: { id: apiKeyId },
  params: {},
  headers: new Headers(),
  searchParams: {},
  user: undefined,
} as never;

describe("createDeleteApiKeyHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    const deleteHandler = createDeleteApiKeyHandler({
      getSession: async () => null,
      db: {} as never,
    });
    const result = await deleteHandler(baseData);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("deletes API key and returns ok", async () => {
    const deleteMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      aPIKey: { delete: deleteMock },
    };
    const deleteHandler = createDeleteApiKeyHandler({
      getSession: async () => ({
        id: "user-1",
        name: "Admin",
        email: "a@b.com",
      }),
      db: db as never,
    });
    const result = await deleteHandler(baseData);

    expect(result.status).toBe(true);
    expect((result as { data?: { ok: boolean } }).data?.ok).toBe(true);
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: apiKeyId } });
  });
});

describe("handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is the factory with production defaults", async () => {
    const deleteMock = vi.fn().mockResolvedValue(undefined);
    const db = { aPIKey: { delete: deleteMock } };
    const deleteHandler = createDeleteApiKeyHandler({
      getSession: async () => ({ id: "user-1", name: "A", email: "a@b.com" }),
      db: db as never,
    });
    const result = await deleteHandler(baseData);
    expect(result.status).toBe(true);
  });
});
