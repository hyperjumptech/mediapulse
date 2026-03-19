/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import { createDeleteEntityTypeHandler } from "./route.post.config";

describe("createDeleteEntityTypeHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    // Setup
    const handler = createDeleteEntityTypeHandler({
      getSession: async () => null,
      db: {} as never,
    });

    // Act
    const result = await handler({
      body: { entityTypeId: "00000000-0000-4000-8000-000000000001" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);

    // Assert
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("returns guard error when entities still reference this type", async () => {
    // Setup
    const db = {
      entity: { count: vi.fn().mockResolvedValue(3) },
      entityType: { delete: vi.fn() },
    };
    const handler = createDeleteEntityTypeHandler({
      getSession: async () => ({ id: "user-1", name: "A", email: "a@b.com" }),
      db: db as never,
    });

    // Act
    const result = await handler({
      body: { entityTypeId: "00000000-0000-4000-8000-000000000001" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);

    // Assert
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe(
      "Cannot delete: 3 entities use this type",
    );
    expect(db.entityType.delete).not.toHaveBeenCalled();
  });

  it("deletes entity type when no references and returns ok", async () => {
    // Setup
    const deleteMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      entity: { count: vi.fn().mockResolvedValue(0) },
      entityType: { delete: deleteMock },
    };
    const handler = createDeleteEntityTypeHandler({
      getSession: async () => ({ id: "user-1", name: "A", email: "a@b.com" }),
      db: db as never,
    });

    // Act
    const result = await handler({
      body: { entityTypeId: "00000000-0000-4000-8000-000000000001" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);

    // Assert
    expect(deleteMock).toHaveBeenCalledWith({
      where: { id: "00000000-0000-4000-8000-000000000001" },
    });
    expect(result).toMatchObject({ status: true, data: { ok: true } });
  });
});
