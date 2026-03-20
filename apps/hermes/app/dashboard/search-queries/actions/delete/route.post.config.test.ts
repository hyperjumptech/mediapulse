/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import { createDeleteSearchQueryHandler } from "./route.post.config";

describe("createDeleteSearchQueryHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    // Setup
    const deleteHandler = createDeleteSearchQueryHandler({
      getSession: async () => null,
      db: {} as never,
    });

    // Act
    const result = await deleteHandler({
      body: { searchQueryId: "00000000-0000-4000-8000-000000000001" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);

    // Assert
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("returns error when search query is referenced by data sources", async () => {
    // Setup
    const count = vi.fn().mockResolvedValue(2);
    const remove = vi.fn().mockResolvedValue(undefined);
    const deleteHandler = createDeleteSearchQueryHandler({
      getSession: async () => ({ id: "user-1", name: "A", email: "a@b.com" }),
      db: {
        dataSource: { count },
        searchQuery: { delete: remove },
      },
    });

    // Act
    const result = await deleteHandler({
      body: { searchQueryId: "00000000-0000-4000-8000-000000000001" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);

    // Assert
    expect(count).toHaveBeenCalledWith({
      where: { searchQueryId: "00000000-0000-4000-8000-000000000001" },
    });
    expect(remove).not.toHaveBeenCalled();
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toContain(
      "Cannot delete this search query",
    );
  });

  it("deletes search query and returns ok when no data-source links exist", async () => {
    // Setup
    const count = vi.fn().mockResolvedValue(0);
    const remove = vi.fn().mockResolvedValue(undefined);
    const deleteHandler = createDeleteSearchQueryHandler({
      getSession: async () => ({ id: "user-1", name: "A", email: "a@b.com" }),
      db: {
        dataSource: { count },
        searchQuery: { delete: remove },
      },
    });

    // Act
    const result = await deleteHandler({
      body: { searchQueryId: "00000000-0000-4000-8000-000000000001" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);

    // Assert
    expect(remove).toHaveBeenCalledWith({
      where: { id: "00000000-0000-4000-8000-000000000001" },
    });
    expect(result).toMatchObject({ status: true, data: { ok: true } });
  });
});
