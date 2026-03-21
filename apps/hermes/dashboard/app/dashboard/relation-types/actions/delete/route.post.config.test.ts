/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import { createDeleteRelationTypeHandler } from "./route.post.config";

describe("createDeleteRelationTypeHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    // Setup
    const handler = createDeleteRelationTypeHandler({
      getSession: async () => null,
      db: {} as never,
    });

    // Act
    const result = await handler({
      body: { relationTypeId: "00000000-0000-4000-8000-000000000001" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);

    // Assert
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("returns guard error when entity relations still reference this type", async () => {
    // Setup
    const db = {
      entityRelation: { count: vi.fn().mockResolvedValue(2) },
      relationType: { delete: vi.fn() },
    };
    const handler = createDeleteRelationTypeHandler({
      getSession: async () => ({ id: "user-1", name: "A", email: "a@b.com" }),
      db: db as never,
    });

    // Act
    const result = await handler({
      body: { relationTypeId: "00000000-0000-4000-8000-000000000001" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);

    // Assert
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe(
      "Cannot delete: 2 entity relations use this type",
    );
    expect(db.relationType.delete).not.toHaveBeenCalled();
  });
});
