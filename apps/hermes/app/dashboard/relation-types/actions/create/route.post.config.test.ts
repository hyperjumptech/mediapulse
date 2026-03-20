/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import { createCreateRelationTypeHandler } from "./route.post.config";

const baseData = {
  body: {
    name: "CEO_OF",
    description: "Executive leadership relation",
  },
  params: {},
  headers: new Headers(),
  searchParams: {},
  user: undefined,
};

describe("createCreateRelationTypeHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    // Setup
    const handler = createCreateRelationTypeHandler({
      getSession: async () => null,
      db: {} as never,
    });

    // Act
    const result = await handler(baseData as never);

    // Assert
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("creates relation type and returns id", async () => {
    // Setup
    const createMock = vi
      .fn()
      .mockResolvedValue({ id: "00000000-0000-4000-8000-000000000001" });
    const db = {
      relationType: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: createMock,
      },
    };
    const handler = createCreateRelationTypeHandler({
      getSession: async () => ({
        id: "user-1",
        name: "Admin",
        email: "admin@example.com",
      }),
      db: db as never,
    });

    // Act
    const result = await handler(baseData as never);

    // Assert
    expect(result.status).toBe(true);
    expect((result as { data?: { id: string } }).data?.id).toBe(
      "00000000-0000-4000-8000-000000000001",
    );
    expect(createMock).toHaveBeenCalledWith({
      data: {
        name: "CEO_OF",
        description: "Executive leadership relation",
      },
    });
  });
});
