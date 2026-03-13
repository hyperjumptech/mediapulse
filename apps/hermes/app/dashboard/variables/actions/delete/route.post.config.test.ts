/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDeleteVariableHandler } from "./route.post.config";

const baseData = {
  body: { id: "00000000-0000-4000-8000-000000000001" },
  params: {},
  headers: new Headers(),
  searchParams: {},
  user: undefined,
} as never;

describe("createDeleteVariableHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    const handler = createDeleteVariableHandler({
      getSession: async () => null,
      db: {} as never,
    });
    const result = await handler(baseData);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("deletes variable and returns ok", async () => {
    const deleteMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      variable: { delete: deleteMock },
    };
    const handler = createDeleteVariableHandler({
      getSession: async () => ({ name: "Admin", email: "a@b.com" }),
      db: db as never,
    });
    const result = await handler(baseData);
    expect(result.status).toBe(true);
    expect((result as { data?: { ok: boolean } }).data?.ok).toBe(true);
    expect(deleteMock).toHaveBeenCalledWith({
      where: { id: baseData.body.id },
    });
  });
});
