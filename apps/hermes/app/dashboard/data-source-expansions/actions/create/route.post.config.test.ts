/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCreateDataSourceExpansionHandler } from "./route.post.config";

const baseData = {
  body: {
    name: "My expansion",
    expansionString: "db:ticker:id",
    description: "All ticker IDs",
  },
  params: {},
  headers: new Headers(),
  searchParams: {},
  user: undefined,
};

describe("createCreateDataSourceExpansionHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    const handler = createCreateDataSourceExpansionHandler({
      getSession: async () => null,
      db: {} as never,
    });
    const result = await handler(baseData as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("creates expansion and returns id", async () => {
    const created = {
      id: "00000000-0000-4000-8000-000000000001",
      name: "My expansion",
      expansionString: "db:ticker:id",
      description: "All ticker IDs",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const handler = createCreateDataSourceExpansionHandler({
      getSession: async () => ({
        id: "user_1",
        name: "Admin",
        email: "admin@example.com",
      }),
      db: {
        dataSourceExpansion: {
          create: vi.fn().mockResolvedValue(created),
        },
      } as never,
    });
    const result = await handler(baseData as never);

    expect(result.status).toBe(true);
    expect((result as { data?: { id: string } }).data?.id).toBe(created.id);
  });
});
