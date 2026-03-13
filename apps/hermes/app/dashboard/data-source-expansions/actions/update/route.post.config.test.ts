/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createUpdateDataSourceExpansionHandler } from "./route.post.config";

const id = "00000000-0000-4000-8000-000000000001";
const baseData = {
  body: {
    id,
    name: "Updated name",
    expansionString: "db:userTicker:all:tickerId",
    description: "Updated desc",
  },
  params: {},
  headers: new Headers(),
  searchParams: {},
  user: undefined,
};

describe("createUpdateDataSourceExpansionHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    const handler = createUpdateDataSourceExpansionHandler({
      getSession: async () => null,
      db: {} as never,
    });
    const result = await handler(baseData as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("returns error when expansion not found", async () => {
    const handler = createUpdateDataSourceExpansionHandler({
      getSession: async () => ({ name: "Admin", email: "admin@example.com" }),
      db: {
        dataSourceExpansion: {
          update: vi.fn().mockRejectedValue(new Error("Record not found")),
        },
      } as never,
    });
    const result = await handler(baseData as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe(
      "Data source expansion not found",
    );
  });

  it("updates expansion and returns ok", async () => {
    const updated = {
      id,
      name: "Updated name",
      expansionString: "db:userTicker:all:tickerId",
      description: "Updated desc",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const handler = createUpdateDataSourceExpansionHandler({
      getSession: async () => ({ name: "Admin", email: "admin@example.com" }),
      db: {
        dataSourceExpansion: {
          update: vi.fn().mockResolvedValue(updated),
        },
      } as never,
    });
    const result = await handler(baseData as never);
    expect(result.status).toBe(true);
    expect((result as { data?: { ok: boolean } }).data?.ok).toBe(true);
  });
});
