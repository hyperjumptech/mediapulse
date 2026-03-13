/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDeleteDataSourceExpansionHandler } from "./route.post.config";

const baseData = {
  body: { id: "00000000-0000-4000-8000-000000000001" },
  params: {},
  headers: new Headers(),
  searchParams: {},
  user: undefined,
};

describe("createDeleteDataSourceExpansionHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    const handler = createDeleteDataSourceExpansionHandler({
      getSession: async () => null,
      db: {} as never,
    });
    const result = await handler(baseData as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("returns error when expansion not found", async () => {
    const handler = createDeleteDataSourceExpansionHandler({
      getSession: async () => ({
        id: "user-1",
        name: "Admin",
        email: "admin@example.com",
      }),
      db: {
        dataSourceExpansion: {
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      } as never,
    });
    const result = await handler(baseData as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe(
      "Data source expansion not found",
    );
  });

  it("deletes expansion and returns ok", async () => {
    const handler = createDeleteDataSourceExpansionHandler({
      getSession: async () => ({
        id: "user-1",
        name: "Admin",
        email: "admin@example.com",
      }),
      db: {
        dataSourceExpansion: {
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      } as never,
    });
    const result = await handler(baseData as never);
    expect(result.status).toBe(true);
    expect((result as { data?: { ok: boolean } }).data?.ok).toBe(true);
  });
});
