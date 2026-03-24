/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDeleteVariableHandler } from "./route.post.config";

const mockDashboardUser = {
  id: "user-1",
  name: "A",
  email: "a@b.com",
} as const;

const baseData = {
  body: { id: "00000000-0000-4000-8000-000000000001" },
  params: {},
  headers: new Headers(),
  searchParams: {},
  user: mockDashboardUser,
};

describe("createDeleteVariableHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes variable and returns ok", async () => {
    const deleteMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      variable: { delete: deleteMock },
    };
    const handler = createDeleteVariableHandler({
      db: db as never,
    });
    const result = await handler(baseData as never);
    expect(result.status).toBe(true);
    expect((result as { data?: { ok: boolean } }).data?.ok).toBe(true);
    expect(deleteMock).toHaveBeenCalledWith({
      where: { id: baseData.body.id },
    });
  });
});
