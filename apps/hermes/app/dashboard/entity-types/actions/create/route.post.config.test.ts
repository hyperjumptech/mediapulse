/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import { createCreateEntityTypeHandler } from "./route.post.config";

const baseData = {
  body: {
    name: "COMPANY",
    description: "Organization entity",
  },
  params: {},
  headers: new Headers(),
  searchParams: {},
  user: undefined,
};

describe("createCreateEntityTypeHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    // Setup
    const handler = createCreateEntityTypeHandler({
      getSession: async () => null,
      db: {} as never,
    });

    // Act
    const result = await handler(baseData as never);

    // Assert
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("returns error when entity type already exists", async () => {
    // Setup
    const db = {
      entityType: {
        findUnique: vi.fn().mockResolvedValue({ id: "existing" }),
        create: vi.fn(),
      },
    };
    const handler = createCreateEntityTypeHandler({
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
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toContain(
      "already exists",
    );
    expect(db.entityType.create).not.toHaveBeenCalled();
  });

  it("creates entity type and returns id", async () => {
    // Setup
    const createMock = vi
      .fn()
      .mockResolvedValue({ id: "00000000-0000-4000-8000-000000000001" });
    const db = {
      entityType: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: createMock,
      },
    };
    const handler = createCreateEntityTypeHandler({
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
        name: "COMPANY",
        description: "Organization entity",
      },
    });
  });
});
