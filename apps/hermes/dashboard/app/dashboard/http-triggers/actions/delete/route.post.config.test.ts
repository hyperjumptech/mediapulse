/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

const mockDashboardUser = {
  id: "user-1",
  name: "A",
  email: "a@b.com",
} as const;

import { createDeleteHttpTriggerHandler } from "./route.post.config";

describe("createDeleteHttpTriggerHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns not found when trigger does not exist", async () => {
    // Setup
    const db = {
      httpTrigger: {
        findUnique: vi.fn().mockResolvedValue(null),
        delete: vi.fn(),
      },
    };
    const handler = createDeleteHttpTriggerHandler({
      db: db as never,
    });

    // Act
    const result = await handler({
      body: { httpTriggerId: "00000000-0000-4000-8000-000000000031" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);

    // Assert
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe(
      "HTTP trigger not found",
    );
    expect(db.httpTrigger.delete).not.toHaveBeenCalled();
  });

  it("deletes trigger and returns ok", async () => {
    // Setup
    const db = {
      httpTrigger: {
        findUnique: vi.fn().mockResolvedValue({ id: "t1" }),
        delete: vi.fn().mockResolvedValue(undefined),
      },
    };
    const handler = createDeleteHttpTriggerHandler({
      db: db as never,
    });

    // Act
    const result = await handler({
      body: { httpTriggerId: "t1" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);

    // Assert
    expect(result.status).toBe(true);
    expect((result as { data?: { ok: boolean } }).data?.ok).toBe(true);
    expect(db.httpTrigger.delete).toHaveBeenCalledWith({ where: { id: "t1" } });
  });
});
