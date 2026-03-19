/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import { createUpdateRelationTypeHandler } from "./route.post.config";

describe("createUpdateRelationTypeHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    // Setup
    const handler = createUpdateRelationTypeHandler({
      getSession: async () => null,
      db: {} as never,
    });

    // Act
    const result = await handler({
      body: {
        relationTypeId: "00000000-0000-4000-8000-000000000001",
        name: "PARTNER_OF",
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

  it("updates relation type and returns ok", async () => {
    // Setup
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const db = { relationType: { update: updateMock } };
    const handler = createUpdateRelationTypeHandler({
      getSession: async () => ({ id: "user-1", name: "A", email: "a@b.com" }),
      db: db as never,
    });

    // Act
    const result = await handler({
      body: {
        relationTypeId: "00000000-0000-4000-8000-000000000001",
        name: "PARTNER_OF",
        description: "Strategic partnership relation",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);

    // Assert
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "00000000-0000-4000-8000-000000000001" },
      data: {
        name: "PARTNER_OF",
        description: "Strategic partnership relation",
      },
    });
    expect(result).toMatchObject({ status: true, data: { ok: true } });
  });
});
