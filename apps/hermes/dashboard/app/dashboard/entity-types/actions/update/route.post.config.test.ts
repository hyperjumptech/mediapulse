/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import { createUpdateEntityTypeHandler } from "./route.post.config";

describe("createUpdateEntityTypeHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    // Setup
    const handler = createUpdateEntityTypeHandler({
      getSession: async () => null,
      db: {} as never,
    });

    // Act
    const result = await handler({
      body: {
        entityTypeId: "00000000-0000-4000-8000-000000000001",
        name: "PERSON",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);

    // Assert
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("updates entity type and returns ok", async () => {
    // Setup
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const db = { entityType: { update: updateMock } };
    const handler = createUpdateEntityTypeHandler({
      getSession: async () => ({ id: "user-1", name: "A", email: "a@b.com" }),
      db: db as never,
    });

    // Act
    const result = await handler({
      body: {
        entityTypeId: "00000000-0000-4000-8000-000000000001",
        name: "PERSON",
        description: "Human individual",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);

    // Assert
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "00000000-0000-4000-8000-000000000001" },
      data: { name: "PERSON", description: "Human individual" },
    });
    expect(result).toMatchObject({ status: true, data: { ok: true } });
  });
});
